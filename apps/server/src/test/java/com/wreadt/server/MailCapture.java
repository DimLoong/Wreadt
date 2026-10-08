package com.wreadt.server;

import com.wreadt.server.mail.MailService;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

/** 测试中收集邮件以便取出令牌 */
@TestConfiguration
public class MailCapture {

    public record Mail(String to, String subject, String body) {}

    static final List<Mail> SENT = new CopyOnWriteArrayList<>();

    @Bean
    @Primary
    MailService capturingMailService() {
        return (to, subject, body) -> SENT.add(new Mail(to, subject, body));
    }
}
