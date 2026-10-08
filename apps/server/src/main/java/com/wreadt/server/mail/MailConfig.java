package com.wreadt.server.mail;

import com.wreadt.server.config.AppProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

/** 配置了 spring.mail.host 时走 SMTP，否则把邮件打印到日志（开发环境）。 */
@Configuration
public class MailConfig {

    private static final Logger log = LoggerFactory.getLogger(MailService.class);

    @Bean
    MailService mailService(ObjectProvider<JavaMailSender> senderProvider, AppProperties props) {
        JavaMailSender sender = senderProvider.getIfAvailable();
        if (sender == null) {
            log.info("未配置 SMTP（spring.mail.host），邮件将输出到日志");
            return (to, subject, body) ->
                    log.info("\n===== 邮件（未发送）=====\nTo: {}\nSubject: {}\n\n{}\n========================", to, subject, body);
        }
        return (to, subject, body) -> {
            SimpleMailMessage msg = new SimpleMailMessage();
            msg.setFrom(props.mailFrom());
            msg.setTo(to);
            msg.setSubject(subject);
            msg.setText(body);
            try {
                sender.send(msg);
            } catch (MailException e) {
                // 发信失败不影响主流程，用户可重新触发
                log.error("发送邮件到 {} 失败", to, e);
            }
        };
    }
}
