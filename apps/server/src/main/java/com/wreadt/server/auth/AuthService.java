package com.wreadt.server.auth;

import com.wreadt.server.auth.AuthDtos.AuthResponse;
import com.wreadt.server.auth.AuthDtos.MeResponse;
import com.wreadt.server.auth.AuthDtos.UserDto;
import com.wreadt.server.auth.OneTimeToken.Purpose;
import com.wreadt.server.common.ApiException;
import com.wreadt.server.common.Tokens;
import com.wreadt.server.config.AppProperties;
import com.wreadt.server.mail.MailService;
import com.wreadt.server.sync.UserSyncState;
import com.wreadt.server.sync.UserSyncStateRepository;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private static final Duration VERIFY_TTL = Duration.ofHours(24);
    private static final Duration RESET_TTL = Duration.ofHours(1);

    private final UserRepository users;
    private final RefreshTokenRepository refreshTokens;
    private final OneTimeTokenRepository oneTimeTokens;
    private final UserSyncStateRepository syncStates;
    private final PasswordEncoder passwordEncoder;
    private final JwtEncoder jwtEncoder;
    private final MailService mail;
    private final AppProperties props;

    public AuthService(UserRepository users, RefreshTokenRepository refreshTokens, OneTimeTokenRepository oneTimeTokens,
            UserSyncStateRepository syncStates, PasswordEncoder passwordEncoder, JwtEncoder jwtEncoder,
            MailService mail, AppProperties props) {
        this.users = users;
        this.refreshTokens = refreshTokens;
        this.oneTimeTokens = oneTimeTokens;
        this.syncStates = syncStates;
        this.passwordEncoder = passwordEncoder;
        this.jwtEncoder = jwtEncoder;
        this.mail = mail;
        this.props = props;
    }

    public static String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    @Transactional
    public AuthResponse register(String rawEmail, String password) {
        String email = normalizeEmail(rawEmail);
        checkPassword(password);
        if (users.existsByEmail(email)) {
            throw new ApiException(HttpStatus.CONFLICT, "EMAIL_TAKEN", "该邮箱已注册");
        }
        User user = users.save(new User(email, passwordEncoder.encode(password)));
        syncStates.save(new UserSyncState(user.getId()));
        String token = issueOneTimeToken(user, Purpose.VERIFY_EMAIL, VERIFY_TTL);
        mail.send(email, "验证你的 Wreadt 邮箱",
                "欢迎使用 Wreadt！请在 24 小时内打开以下链接完成邮箱验证：\n\n"
                        + props.appUrl() + "/verify-email?token=" + token
                        + "\n\n如果这不是你本人的操作，请忽略本邮件。");
        return issueTokens(user);
    }

    @Transactional
    public AuthResponse login(String rawEmail, String password) {
        User user = users.findByEmail(normalizeEmail(rawEmail))
                .filter(u -> passwordEncoder.matches(password, u.getPasswordHash()))
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "邮箱或密码错误"));
        return issueTokens(user);
    }

    /** 轮换：旧 refresh token 立即删除（过期的也一并清掉，因此不因异常回滚）。 */
    @Transactional(noRollbackFor = ApiException.class)
    public AuthResponse refresh(String refreshToken) {
        RefreshToken stored = refreshTokens.findById(Tokens.sha256(refreshToken))
                .orElseThrow(() -> ApiException.unauthorized("登录已失效，请重新登录"));
        refreshTokens.delete(stored);
        if (stored.getExpiresAt().isBefore(Instant.now())) {
            throw ApiException.unauthorized("登录已失效，请重新登录");
        }
        User user = users.findById(stored.getUserId())
                .orElseThrow(() -> ApiException.unauthorized("登录已失效，请重新登录"));
        return issueTokens(user);
    }

    @Transactional
    public void logout(String refreshToken) {
        refreshTokens.deleteById(Tokens.sha256(refreshToken));
    }

    @Transactional
    public void verifyEmail(String token) {
        OneTimeToken t = consume(token, Purpose.VERIFY_EMAIL);
        users.findById(t.getUserId()).ifPresent(u -> u.setEmailVerified(true));
    }

    @Transactional
    public void forgotPassword(String rawEmail) {
        users.findByEmail(normalizeEmail(rawEmail)).ifPresent(user -> {
            String token = issueOneTimeToken(user, Purpose.RESET_PASSWORD, RESET_TTL);
            mail.send(user.getEmail(), "重置你的 Wreadt 密码",
                    "请在 1 小时内打开以下链接重置密码：\n\n"
                            + props.appUrl() + "/reset-password?token=" + token
                            + "\n\n如果这不是你本人的操作，请忽略本邮件，你的密码不会改变。");
        });
    }

    @Transactional
    public void resetPassword(String token, String password) {
        checkPassword(password);
        OneTimeToken t = consume(token, Purpose.RESET_PASSWORD);
        User user = users.findById(t.getUserId()).orElseThrow(ApiException::invalidToken);
        user.setPasswordHash(passwordEncoder.encode(password));
        // 能收到重置邮件即证明拥有该邮箱
        user.setEmailVerified(true);
        refreshTokens.deleteAllByUserId(user.getId());
    }

    @Transactional(readOnly = true)
    public MeResponse me(UUID userId) {
        User u = users.findById(userId).orElseThrow(() -> ApiException.unauthorized("用户不存在"));
        return new MeResponse(u.getId(), u.getEmail(), u.isEmailVerified(), u.getCreatedAt());
    }

    private OneTimeToken consume(String token, Purpose purpose) {
        OneTimeToken t = oneTimeTokens.findById(Tokens.sha256(token))
                .filter(x -> x.isUsable(purpose, Instant.now()))
                .orElseThrow(ApiException::invalidToken);
        t.markUsed();
        return t;
    }

    private String issueOneTimeToken(User user, Purpose purpose, Duration ttl) {
        String token = Tokens.random();
        oneTimeTokens.save(new OneTimeToken(Tokens.sha256(token), user.getId(), purpose, Instant.now().plus(ttl)));
        return token;
    }

    private AuthResponse issueTokens(User user) {
        Instant now = Instant.now();
        Duration accessTtl = props.jwt().accessTtl();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer("wreadt")
                .subject(user.getId().toString())
                .claim("email", user.getEmail())
                .issuedAt(now)
                .expiresAt(now.plus(accessTtl))
                .build();
        String accessToken = jwtEncoder
                .encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims))
                .getTokenValue();
        String refreshToken = Tokens.random();
        refreshTokens.save(new RefreshToken(Tokens.sha256(refreshToken), user.getId(), now.plus(props.jwt().refreshTtl())));
        return new AuthResponse(accessToken, refreshToken, accessTtl.toSeconds(), UserDto.of(user));
    }

    private static void checkPassword(String password) {
        if (password.length() < 8) {
            throw ApiException.validation("密码至少 8 位");
        }
        // BCrypt 只处理前 72 字节
        if (password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw ApiException.validation("密码过长");
        }
    }
}
