import { splitMeaning } from "../../lib/meaning";

/** 释义横排：词性为次要色，释义为主色 */
export default function MeaningRow({ meanings }: { meanings: string[] }) {
  return (
    <div className="meaning-row">
      {meanings.map((m) => {
        const { pos, text } = splitMeaning(m);
        return (
          <span key={m} className="meaning-item">
            {pos && <span className="pos">{pos}</span>}
            <span>{text}</span>
          </span>
        );
      })}
    </div>
  );
}
