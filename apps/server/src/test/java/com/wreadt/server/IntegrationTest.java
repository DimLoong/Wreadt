package com.wreadt.server;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(MailCapture.class)
public abstract class IntegrationTest {

    @Autowired
    protected MockMvc mvc;
    @Autowired
    protected ObjectMapper json;

    protected static String uniqueEmail() {
        return "u-" + UUID.randomUUID() + "@example.com";
    }

    protected ResultActions postJson(String url, Object body) throws Exception {
        return mvc.perform(post(url).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)));
    }

    protected ResultActions postJson(String url, String accessToken, Object body) throws Exception {
        return mvc.perform(post(url).header("Authorization", "Bearer " + accessToken)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)));
    }

    protected JsonNode body(ResultActions result) throws Exception {
        return json.readTree(result.andReturn().getResponse().getContentAsString());
    }

    /** 注册并返回 AuthResponse */
    protected JsonNode register(String email, String password) throws Exception {
        return body(postJson("/api/auth/register", Map.of("email", email, "password", password))
                .andExpect(status().isCreated()));
    }

    protected String accessToken() throws Exception {
        return register(uniqueEmail(), "password123").get("accessToken").asString();
    }

    /** 取发往该邮箱的最近一封邮件中 path?token= 后的令牌 */
    protected static String tokenFromMail(String email, String path) {
        Pattern p = Pattern.compile(Pattern.quote(path) + "\\?token=([A-Za-z0-9_-]+)");
        for (int i = MailCapture.SENT.size() - 1; i >= 0; i--) {
            MailCapture.Mail m = MailCapture.SENT.get(i);
            Matcher matcher = p.matcher(m.body());
            if (m.to().equals(email) && matcher.find()) {
                return matcher.group(1);
            }
        }
        throw new AssertionError("没有找到发往 " + email + " 的 " + path + " 邮件");
    }

    protected static long mailCount(String email) {
        return MailCapture.SENT.stream().filter(m -> m.to().equals(email)).count();
    }
}
