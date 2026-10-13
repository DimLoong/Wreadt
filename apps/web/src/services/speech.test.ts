import { voiceScore } from "./speech";

const v = (name: string, lang = "en-US", localService = true) => ({ name, lang, localService });

it("voiceScore：神经 / 在线语音优先，趣味声音与非英文排除", () => {
  const natural = voiceScore(v("Microsoft Aria Online (Natural) - English (United States)", "en-US", false), "us");
  const google = voiceScore(v("Google US English", "en-US", false), "us");
  const samantha = voiceScore(v("Samantha"), "us");
  expect(natural).toBeGreaterThan(google);
  expect(google).toBeGreaterThan(samantha);
  expect(voiceScore(v("Zarvox"), "us")).toBe(-100);
  expect(voiceScore(v("Ting-Ting", "zh-CN"), "us")).toBe(-100);
  // 英音偏好
  expect(voiceScore(v("Daniel", "en-GB"), "uk")).toBeGreaterThan(voiceScore(v("Daniel", "en-GB"), "us"));
});
