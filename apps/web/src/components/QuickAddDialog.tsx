import { useNavigate } from "react-router-dom";
import { Button, Dialog } from "tdesign-react";
import { BookOpenIcon } from "tdesign-icons-react";
import { useSettings } from "../context/settings";
import AddWordsPanel from "./AddWordsPanel";

/** 快速添加单词：导航“词库”旁的加号打开，不离开当前页面；底部引导想要整套词库的用户去 AI 创建 */
export default function QuickAddDialog({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useSettings();
  const navigate = useNavigate();
  return (
    <Dialog visible={visible} onClose={onClose} header={t("vocab.quickAdd")} footer={false} width="min(720px, 94vw)" destroyOnClose className="quick-add-dialog">
      <p className="muted quick-add-desc">{t("add.desc")}</p>
      <AddWordsPanel />
      <div className="quick-add-dict">
        <span className="quick-add-dict-icon">
          <BookOpenIcon />
        </span>
        <div className="quick-add-dict-text">
          <strong>{t("vocab.quickAddDictTitle")}</strong>
          <span className="muted">{t("vocab.quickAddDictDesc")}</span>
        </div>
        <Button
          theme="primary"
          variant="outline"
          onClick={() => {
            onClose();
            navigate("/vocabulary/new");
          }}
        >
          {t("vocab.create")}
        </Button>
      </div>
    </Dialog>
  );
}
