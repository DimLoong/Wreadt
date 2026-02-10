import { Button, Card } from "tdesign-react";
import { useNavigate } from "react-router-dom";

export default function SentencePracticePage() {
  const navigate = useNavigate();
  return (
    <main className="typing-page linear-home">
      <Card className="typing-main-card" bordered>
        <h2>造句练习</h2>
        <p>单词完成后可在此进行扩展造句练习。</p>
        <Button theme="primary" onClick={() => navigate("/")}>返回首页</Button>
      </Card>
    </main>
  );
}
