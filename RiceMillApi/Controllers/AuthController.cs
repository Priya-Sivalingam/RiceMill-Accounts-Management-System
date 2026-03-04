using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using RiceMillApi.Data;
using RiceMillApi.Models;

namespace RiceMillApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;

    public AuthController(AppDbContext db, IConfiguration config)
    {
        _db = db;
        _config = config;
    }

    // ─────────────────────────────────────────
    // POST api/auth/login
    // ─────────────────────────────────────────
    /// <summary>Login and get JWT token</summary>
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var user = await _db.Users
            .FirstOrDefaultAsync(u => u.Username == request.Username && u.IsActive);

        if (user == null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            return Unauthorized(new { message = "Invalid username or password" });

        var token = GenerateToken(user.UserId, user.Username, user.Role);

        return Ok(new
        {
            token,
            user = new { user.UserId, user.Username, user.FullName, user.Role }
        });
    }

    // ─────────────────────────────────────────
    // GET api/auth/users
    // ─────────────────────────────────────────
    /// <summary>Get all users (Admin only)</summary>
    [HttpGet("users")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetAll()
    {
        var users = await _db.Users
            .Where(u => u.IsActive)
            .OrderBy(u => u.Username)
            .Select(u => new {
                u.UserId,
                u.Username,
                u.FullName,
                u.Role,
                u.IsActive,
                u.CreatedAt
            })
            .ToListAsync();

        return Ok(users);
    }

    // ─────────────────────────────────────────
    // GET api/auth/users/{id}
    // ─────────────────────────────────────────
    /// <summary>Get single user by ID (Admin or own profile)</summary>
    [HttpGet("users/{id}")]
    [Authorize]
    public async Task<IActionResult> GetById(int id)
    {
        // Allow admins to view anyone; regular users can only view themselves
        var requesterId    = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var requesterRole  = User.FindFirstValue(ClaimTypes.Role);

        if (requesterRole != "Admin" && requesterId != id)
            return Forbid();

        var user = await _db.Users.FindAsync(id);
        if (user == null || !user.IsActive) return NotFound();

        return Ok(new {
            user.UserId,
            user.Username,
            user.FullName,
            user.Role,
            user.IsActive,
            user.CreatedAt
        });
    }

    // ─────────────────────────────────────────
    // POST api/auth/register
    // ─────────────────────────────────────────
    /// <summary>Register a new user (Admin only)</summary>
    [HttpPost("register")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        if (await _db.Users.AnyAsync(u => u.Username == request.Username))
            return Conflict(new { message = $"Username '{request.Username}' already exists." });

        var user = new User
        {
            Username     = request.Username,
            FullName     = request.FullName,
            Role         = request.Role,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            IsActive     = true,
            CreatedAt    = DateTime.UtcNow
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = user.UserId }, new {
            user.UserId, user.Username, user.FullName, user.Role
        });
    }

    // ─────────────────────────────────────────
    // PUT api/auth/users/{id}
    // ─────────────────────────────────────────
    /// <summary>Update user info (Admin or own profile)</summary>
    [HttpPut("users/{id}")]
    [Authorize]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateUserRequest request)
    {
        var requesterId   = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var requesterRole = User.FindFirstValue(ClaimTypes.Role);

        if (requesterRole != "Admin" && requesterId != id)
            return Forbid();

        var user = await _db.Users.FindAsync(id);
        if (user == null || !user.IsActive) return NotFound();

        // Only admin can change roles
        if (request.Role != null && requesterRole != "Admin")
            return Forbid();

        // Check username conflict (exclude self)
        if (request.Username != null &&
            await _db.Users.AnyAsync(u => u.Username == request.Username && u.UserId != id))
            return Conflict(new { message = $"Username '{request.Username}' already exists." });

        user.FullName = request.FullName ?? user.FullName;
        user.Username = request.Username ?? user.Username;
        user.Role     = request.Role     ?? user.Role;

        // Update password only if provided
        if (!string.IsNullOrWhiteSpace(request.NewPassword))
        {
            // Non-admins must verify their current password
            if (requesterRole != "Admin")
            {
                if (string.IsNullOrWhiteSpace(request.CurrentPassword) ||
                    !BCrypt.Net.BCrypt.Verify(request.CurrentPassword, user.PasswordHash))
                    return BadRequest(new { message = "Current password is incorrect." });
            }
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        }

        await _db.SaveChangesAsync();

        return Ok(new {
            user.UserId, user.Username, user.FullName, user.Role
        });
    }

    // ─────────────────────────────────────────
    // DELETE api/auth/users/{id}
    // ─────────────────────────────────────────
    /// <summary>Soft delete a user (Admin only)</summary>
    [HttpDelete("users/{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Delete(int id)
    {
        var requesterId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        if (requesterId == id)
            return BadRequest(new { message = "You cannot delete your own account." });

        var user = await _db.Users.FindAsync(id);
        if (user == null || !user.IsActive) return NotFound();

        user.IsActive = false;
        await _db.SaveChangesAsync();

        return Ok(new { message = $"User '{user.Username}' has been deactivated." });
    }

    // ─────────────────────────────────────────
    // Token Generator (private)
    // ─────────────────────────────────────────
    private string GenerateToken(int userId, string username, string role)
    {
        var jwtSettings = _config.GetSection("JwtSettings");
        var key   = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings["SecretKey"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
            new Claim(ClaimTypes.Name, username),
            new Claim(ClaimTypes.Role, role)
        };

        var token = new JwtSecurityToken(
            issuer:             jwtSettings["Issuer"],
            audience:           jwtSettings["Audience"],
            claims:             claims,
            expires:            DateTime.UtcNow.AddHours(double.Parse(jwtSettings["ExpiryHours"]!)),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

// ─────────────────────────────────────────
// Request DTOs
// ─────────────────────────────────────────
public record LoginRequest(string Username, string Password);

public record RegisterRequest(
    string Username,
    string Password,
    string FullName,
    string Role         // "Admin" | "Cashier" | "Manager" etc.
);

public class UpdateUserRequest
{
    public string? Username        { get; set; }
    public string? FullName        { get; set; }
    public string? Role            { get; set; }
    public string? CurrentPassword { get; set; }  // Required for self password change
    public string? NewPassword     { get; set; }
}