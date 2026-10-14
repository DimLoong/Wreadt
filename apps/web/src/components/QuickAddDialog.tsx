import { Dialog } from "tdesign-react";
import { useSettings } from "../context/settings";
import AddWordsPanel from "./AddWordsPanel";

/** 快速添加词汇：导航“词库”旁的加号打开，不离开当前页面 */
export default function QuickAddDialog({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useSettings();
  return (
    <Dialog visible={visible} onClose={onClose} header={t("vocab.quickAdd")} footer={false} width="min(720px, 94vw)" destroyOnClose className="quick-add-dialog">
      <p className="muted quick-add-desc">{t("add.desc")}</p>
      <AddWordsPanel />
    </Dialog>
  );
}
