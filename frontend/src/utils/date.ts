export const formatTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) {
    return date.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } else if (diffDays === 1) {
    return "昨天";
  } else if (diffDays < 7) {
    return `${diffDays}天前`;
  } else {
    return date.toLocaleDateString("zh-CN", {
      month: "short",
      day: "numeric",
    });
  }
};

export const formatMonthDay = (dateString?: string | null) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    return dateString;
  }
  return date
    .toLocaleDateString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
    })
    .replace(/\//g, "-");
};
