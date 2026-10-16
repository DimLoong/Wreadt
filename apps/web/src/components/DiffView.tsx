import { Fragment } from "react";
import type { SentenceDiff } from "@wreadt/core";

/** 逐词对比结果：对的绿色，写错的红色并给出正确写法，漏掉的灰色，多打的划掉（整句听写、造句卡共用） */
export default function DiffView({ diff }: { diff: SentenceDiff }) {
  return (
    <p className="dictation-diff" lang="en">
      {diff.tokens.map((tk, i) => (
        <Fragment key={i}>
          {tk.status === "ok" && <span className="ok">{tk.expected}</span>}
          {tk.status === "wrong" && (
            <span className="wrong">
              <s>{tk.typed}</s> {tk.expected}
            </span>
          )}
          {tk.status === "missing" && <span className="missing">{tk.expected}</span>}
          {tk.status === "extra" && (
            <span className="extra">
              <s>{tk.typed}</s>
            </span>
          )}{" "}
        </Fragment>
      ))}
    </p>
  );
}
