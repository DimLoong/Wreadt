import { Dialog } from "tdesign-react";
import { useSettings } from "../../context/settings";

/** 走到最后还有题没做：确认是结束本组，还是回去做完（Esc / 关闭也算回去） */
export default function FinishConfirm({ count, onFinish, onBack }: { count: number; onFinish: () => void; onBack: () => void }) {
  const { t } = useSettings();
  return (
    <Dialog
      visible
      header={t("finish.title", { count })}
      confirmBtn={t("finish.back")}
      cancelBtn={t("finish.end")}
      confirmOnEnter
      onConfirm={onBack}
      onCancel={onFinish}
      onClose={({ trigger }) => trigger !== "cancel" && onBack()}
      width={400}
      className="finish-confirm"
    >
      {t("finish.desc")}
    </Dialog>
  );
}
