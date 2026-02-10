import { Button, Card } from "tdesign-react";
import { useNavigate } from "react-router-dom";

export default function CustomVocabPage() {
  const navigate = useNavigate();
  return (
    <main className="typing-page linear-home">
      <Card className="typing-main-card" bordered>
        <h2>词库页</h2>
        <p>当前支持英日分离词库切换，每个词库 3 个词。</p>
        <Button theme="primary" onClick={() => navigate("/")}>返回首页</Button>
      </Card>
    </main>
  );
}
