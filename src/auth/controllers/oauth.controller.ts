import { Controller, Get, Post, Body, Req, Res, UseGuards, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { GoogleOAuthGuard } from '../guards/google-oauth.guard';
import { OAuthService } from '../services/oauth.service';
import { CookieService } from '../services/cookie.service';
import { ConfigService } from '@nestjs/config';

/**
 * OAuth Authentication Controller
 * 
 * Handles OAuth authentication flows for multiple providers.
 * Currently supports: Google OAuth 2.0
 * 
 * Endpoints:
 * - GET /auth/oauth/google - Initiates Google OAuth flow
 * - GET /auth/oauth/google/callback - Handles Google OAuth callback
 * 
 * Enterprise Features:
 * - Secure cookie-based authentication
 * - Automatic token refresh
 * - Frontend redirect with error handling
 * - Comprehensive logging and monitoring
 * - CORS-compliant authentication
 * 
 * Security:
 * - HTTP-only cookies for tokens
 * - SameSite=Strict for CSRF protection
 * - Secure flag in production
 * - State parameter validation
 * 
 * @class OAuthController
 */
@Controller('auth/oauth')
export class OAuthController {
  private readonly logger = new Logger(OAuthController.name);
  private readonly frontendUrl: string;

  constructor(
    private readonly oauthService: OAuthService,
    private readonly cookieService: CookieService,
    private readonly configService: ConfigService,
  ) {
    this.frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
  }

  /**
   * Initiate Google OAuth Flow
   * 
   * Redirects user to Google's OAuth consent screen.
   * Passport automatically handles:
   * - OAuth URL construction
   * - State parameter generation (CSRF protection)
   * - Scope parameter inclusion
   * - Redirect URI validation
   * 
   * @route GET /auth/oauth/google
   * @guard GoogleOAuthGuard
   * 
   * Flow:
   * 1. User clicks "Login with Google"
   * 2. Frontend redirects to this endpoint
   * 3. Backend redirects to Google OAuth
   * 4. User authorizes on Google
   * 5. Google redirects to callback URL
   * 
   * @example
   * // Frontend implementation:
   * <a href="http://api.example.com/auth/oauth/google">
   *   Login with Google
   * </a>
   */
  @Get('google')
  @UseGuards(GoogleOAuthGuard)
  async googleLogin() {
    // Passport handles the redirect to Google
    this.logger.log('🚀 Initiating Google OAuth flow');
  }

  /**
   * Google OAuth Callback Handler
   * 
   * Handles the OAuth callback from Google after user authorization.
   * Implements comprehensive error handling and user provisioning.
   * 
   * @route GET /auth/oauth/google/callback
   * @guard GoogleOAuthGuard
   * 
   * Flow:
   * 1. Google redirects with authorization code
   * 2. GoogleOAuthGuard validates and exchanges code for tokens
   * 3. Strategy validates and extracts user profile
   * 4. This handler receives authenticated user
   * 5. Create/update user in database
   * 6. Generate JWT tokens
   * 7. Set secure HTTP-only cookies
   * 8. Redirect to frontend success page
   * 
   * Error Handling:
   * - OAuth errors → Redirect to error page
   * - Database errors → Redirect with error message
   * - Network errors → Redirect with retry option
   * 
   * @param req - Express request with authenticated user
   * @param res - Express response for cookie setting
   * @returns Redirect to frontend with authentication state
   * 
   * @example
   * // Successful response sets cookies and redirects:
   * Set-Cookie: access_token=<JWT>; HttpOnly; Secure; SameSite=Strict
   * Set-Cookie: refresh_token=<JWT>; HttpOnly; Secure; SameSite=Strict
   * Location: http://localhost:3000/dashboard
   */
  @Get('google/callback')
  @UseGuards(GoogleOAuthGuard)
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    try {
      this.logger.log('✅ [OAUTH] Google OAuth callback received');

      // Extract OAuth user from request (set by Passport strategy)
      const oauthUser = req.user as any;

      if (!oauthUser) {
        this.logger.warn('❌ [OAUTH] No user data in OAuth callback');
        return res.redirect(`${this.frontendUrl}/api/auth/oauth/callback?message=Authentication failed`);
      }

      this.logger.log(`🔍 [OAUTH] Processing OAuth user: ${oauthUser.email}`);

      // Authenticate or create user
      const result = await this.oauthService.authenticateOAuthUser(oauthUser);

      this.logger.log('🍪 [OAUTH] Setting authentication cookies');
      this.logger.log(`🔑 [OAUTH] Access token length: ${result.access_token?.length}`);
      this.logger.log(`🔑 [OAUTH] Refresh token length: ${result.refresh_token?.length}`);

      // Set authentication cookies using CookieService
      this.cookieService.setAuthCookies(res, result.access_token, result.refresh_token);

      this.logger.log(`✅ [OAUTH] OAuth authentication successful for: ${result.user.email}`);
      this.logger.log(`🧭 [OAUTH] Redirecting to: ${this.frontendUrl}/api/auth/oauth/callback?oauth=success`);

      // Redirect to frontend OAuth proxy (not directly to callback page)
      // The proxy will handle cookie forwarding for cross-origin scenarios
      return res.redirect(`${this.frontendUrl}/api/auth/oauth/callback?oauth=success`);
    } catch (error) {
      this.logger.error('❌ [OAUTH] OAuth callback failed:', error);
      this.logger.error('❌ [OAUTH] Error stack:', error.stack);

      // Redirect to frontend OAuth proxy with error
      const errorMessage = encodeURIComponent(
        error.message || 'Authentication failed'
      );
      return res.redirect(`${this.frontendUrl}/api/auth/oauth/callback?message=${errorMessage}`);
    }
  }

  /**
   * OAuth Success Endpoint
   * 
   * Alternative endpoint that returns JSON instead of redirect.
   * Useful for mobile apps or SPAs that prefer JSON responses.
   * 
   * @route GET /auth/oauth/success
   * @returns User data and tokens in JSON format
   * 
   * @example
   * // Response:
   * {
   *   "success": true,
   *   "user": { ... },
   *   "message": "OAuth authentication successful"
   * }
   */
  @Get('success')
  async oauthSuccess(@Req() req: Request) {
    const user = req.user;
    
    return {
      success: true,
      user,
      message: 'OAuth authentication successful',
    };
  }

  /**
   * OAuth Error Endpoint
   * 
   * Handles OAuth errors with detailed error information.
   * Provides user-friendly error messages and retry options.
   * 
   * @route GET /auth/oauth/error
   * @returns Error details in JSON format
   * 
   * @example
   * // Response:
   * {
   *   "success": false,
   *   "error": "OAuth authentication failed",
   *   "details": "User denied access"
   * }
   */
  @Get('error')
  async oauthError(@Req() req: Request) {
    const errorMessage = req.query.message || 'OAuth authentication failed';
    
    return {
      success: false,
      error: errorMessage,
      message: 'Please try again or use a different authentication method',
    };
  }

  /**
   * TEST ENDPOINT: Simulate OAuth Login (POSTMAN/API TESTING ONLY)
   * 
   * This endpoint simulates the OAuth flow for testing purposes.
   * It bypasses Google OAuth and directly creates/authenticates a user.
   * 
   * ⚠️ WARNING: This should be DISABLED in production or protected by API key!
   * 
   * @route POST /auth/oauth/test
   * @body { email, firstName, lastName, profilePic }
   * @returns JSON response with user data and tokens
   * 
   * @example Postman Request:
   * POST http://localhost:3001/auth/oauth/test
   * Content-Type: application/json
   * 
   * {
   *   "email": "test@gmail.com",
   *   "firstName": "Test",
   *   "lastName": "User",
   *   "profilePic": "https://example.com/photo.jpg"
   * }
   * 
   * @example Response:
   * {
   *   "success": true,
   *   "message": "OAuth authentication successful (TEST MODE)",
   *   "user": { ... },
   *   "access_token": "eyJhbGc...",
   *   "refresh_token": "eyJhbGc...",
   *   "remainingSlots": 5
   * }
   */
  @Post('test')
  async testOAuthLogin(
    @Body() testUser: { email: string; firstName?: string; lastName?: string; profilePic?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      this.logger.warn('⚠️ [OAUTH-TEST] Using TEST endpoint - not for production!');
      
      // Validate test user data
      if (!testUser.email) {
        return {
          success: false,
          error: 'Email is required',
        };
      }

      // Simulate OAuth user data
      const oauthUser = {
        email: testUser.email,
        firstName: testUser.firstName || 'Test',
        lastName: testUser.lastName || 'User',
        profilePic: testUser.profilePic || 'https://via.placeholder.com/150',
        googleId: `test_${Date.now()}`,
        provider: 'google_test',
        isVerified: true,
      };

      this.logger.log(`🧪 [OAUTH-TEST] Testing OAuth for: ${oauthUser.email}`);

      // Authenticate or create user (same logic as real OAuth)
      const result = await this.oauthService.authenticateOAuthUser(oauthUser);

      // Set cookies (so Postman can capture them)
      this.cookieService.setAuthCookies(res, result.access_token, result.refresh_token);

      this.logger.log(`✅ [OAUTH-TEST] Test OAuth successful for: ${result.user.email}`);

      // Return JSON response with tokens (Postman-friendly)
      return {
        success: true,
        message: 'OAuth authentication successful (TEST MODE)',
        user: result.user,
        access_token: result.access_token,
        refresh_token: result.refresh_token,
        remainingSlots: result.remainingSlots,
        cookies: {
          access_token: `Set in HTTP-only cookie (maxAge: ${this.configService.get('JWT_EXPIRES_IN_MS')}ms)`,
          refresh_token: `Set in HTTP-only cookie (maxAge: ${this.configService.get('JWT_REFRESH_EXPIRES_IN_MS')}ms)`,
        },
      };
    } catch (error) {
      this.logger.error('❌ [OAUTH-TEST] Test OAuth failed:', error);
      
      return {
        success: false,
        error: error.message || 'Test OAuth authentication failed',
        details: error.stack,
      };
    }
  }
}
