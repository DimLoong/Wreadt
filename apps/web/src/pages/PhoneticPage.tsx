import { Button, Card } from "tdesign-react";
import { useNavigate } from "react-router-dom";

export default function PhoneticPage() {
  const navigate = useNavigate();
  return (
    <main className="typing-page linear-home">
      <Card className="typing-main-card" bordered>
        <h2>音标页</h2>
        <p>这里展示当前训练词的音标与易混音信息。</p>
        <Button theme="primary" onClick={() => navigate("/")}>返回首页</Button>
      </Card>
    </main>
  );
}
