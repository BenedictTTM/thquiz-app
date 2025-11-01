import { Injectable, Logger } from '@nestjs/common';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';

export interface AuthResult {
  user: any;
  success: boolean;
  message: string;
  remainingSlots?: number;
}

@Injectable()
export class CookieService {
  private readonly logger = new Logger(CookieService.name);

  constructor(private readonly configService: ConfigService) {}

  setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
    const isProduction = this.configService.get('NODE_ENV') === 'production';
    const frontendUrl = this.configService.get('FRONTEND_URL', 'http://localhost:3000');
    const isLocalhost = frontendUrl.includes('localhost') || frontendUrl.includes('127.0.0.1');
    
    const accessTokenMaxAge = parseInt(this.configService.get('JWT_EXPIRES_IN_MS', '1500000'));
    const refreshTokenMaxAge = parseInt(this.configService.get('JWT_REFRESH_EXPIRES_IN_MS', '604800000'));
    
    this.logger.log('🍪 [COOKIE] Setting authentication cookies', {
      isProduction,
      isLocalhost,
      frontendUrl,
      accessTokenMaxAge,
      refreshTokenMaxAge,
      accessTokenLength: accessToken?.length,
      refreshTokenLength: refreshToken?.length,
      nodeEnv: this.configService.get('NODE_ENV'),
    });
    
    // Cookie settings based on environment:
    // - Localhost: SameSite=lax, Secure=false (HTTP works)
    // - Production: SameSite=none, Secure=true (HTTPS required for cross-origin)
    const cookieOptions: any = {
      httpOnly: true,
      secure: !isLocalhost, // false for localhost, true for production
      sameSite: isLocalhost ? ('lax' as const) : ('none' as const),
      path: '/',
    };
    
    // Don't set domain for localhost, but DO NOT set it for production either
    // Setting domain can cause issues with cross-origin cookies
    // Browser will automatically use the response domain (sellr-backend-1.onrender.com)
    
    this.logger.log('🍪 [COOKIE] Cookie options:', cookieOptions);
    
    res.cookie('access_token', accessToken, {
      ...cookieOptions,
      maxAge: accessTokenMaxAge,
    });
    
    this.logger.log('✅ [COOKIE] access_token cookie set');
    
    res.cookie('refresh_token', refreshToken, {
      ...cookieOptions,
      maxAge: refreshTokenMaxAge,
    });

    this.logger.log('✅ [COOKIE] refresh_token cookie set');
    this.logger.log('✅ [COOKIE] All authentication cookies set successfully');
  }

  clearAuthCookies(res: Response): void {
    this.logger.log('🧹 [COOKIE] Clearing authentication cookies');
    
    const frontendUrl = this.configService.get('FRONTEND_URL', 'http://localhost:3000');
    const isLocalhost = frontendUrl.includes('localhost') || frontendUrl.includes('127.0.0.1');
    
    const cookieOptions = {
      httpOnly: true,
      path: '/',
      secure: !isLocalhost,
      sameSite: isLocalhost ? ('lax' as const) : ('none' as const),
    };

    res.clearCookie('access_token', cookieOptions);
    res.clearCookie('refresh_token', cookieOptions);
    
    this.logger.log('✅ [COOKIE] Authentication cookies cleared');
  }

  // Helper method to handle auth response with cookies
  handleAuthResponse(res: Response, result: any): AuthResult {
    this.logger.debug('📝 Processing auth response...');
    
    if (result.access_token && result.refresh_token) {
      this.setAuthCookies(res, result.access_token, result.refresh_token);
      
      // Remove tokens from response
      const { access_token, refresh_token, ...cleanResult } = result;
      this.logger.debug('✅ Auth response processed - tokens moved to cookies');
      return cleanResult;
    }
    
    this.logger.warn('⚠️ No tokens found in auth response');
    return result;
  }

  // Helper method to handle logout with cookie cleanup
  handleLogoutResponse(res: Response, result: any): any {
    this.logger.debug('🚪 Processing logout response...');
    this.clearAuthCookies(res);
    this.logger.debug('✅ Logout response processed');
    return result;
  }
}