import { Button, Card } from "tdesign-react";
import { useNavigate } from "react-router-dom";

export default function ProgressPage() {
  const navigate = useNavigate();
  return (
    <main className="typing-page linear-home">
      <Card className="typing-main-card" bordered>
        <h2>学习进度</h2>
        <p>完成单元后会触发单元完成动画，并展示热力图结果。</p>
        <Button theme="primary" onClick={() => navigate("/")}>返回首页</Button>
      </Card>
    </main>
  );
}
