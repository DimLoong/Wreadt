/** 示范回复作者的头像（DiceBear dylan 风格，按作者描述生成，同一个作者头像固定） */
export default function Avatar({ seed, size = 28 }: { seed: string; size?: number }) {
  return (
    <img
      className="feed-avatar"
      src={`https://api.dicebear.com/10.x/dylan/svg?seed=${encodeURIComponent(seed)}`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  );
}
