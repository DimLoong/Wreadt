package com.wreadt.server.mail;

public interface MailService {

    void send(String to, String subject, String body);
}
