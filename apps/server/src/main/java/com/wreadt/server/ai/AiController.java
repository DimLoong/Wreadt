package com.wreadt.server.ai;

import com.wreadt.server.ai.AiDtos.ExamplesRequest;
import com.wreadt.server.ai.AiDtos.ExamplesResponse;
import com.wreadt.server.ai.AiDtos.ExercisesRequest;
import com.wreadt.server.ai.AiDtos.ExercisesResponse;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AiController {

    private final AiService ai;

    public AiController(AiService ai) {
        this.ai = ai;
    }

    @PostMapping("/api/ai/sentence-exercises")
    ExercisesResponse sentenceExercises(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody ExercisesRequest req) {
        return ai.sentenceExercises(UUID.fromString(jwt.getSubject()), req);
    }

    @PostMapping("/api/ai/word-examples")
    ExamplesResponse wordExamples(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody ExamplesRequest req) {
        return ai.wordExamples(UUID.fromString(jwt.getSubject()), req);
    }
}
