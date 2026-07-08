export const getTheme = (): string => {
  return localStorage.getItem("lanlink-theme") || "light";
};

export const setTheme = (theme: string): void => {
  localStorage.setItem("lanlink-theme", theme);
};

export const getNickname = (): string => {
  return localStorage.getItem("lanlink_guest_name") || "게스트";
};

export const setNickname = (nickname: string): void => {
  localStorage.setItem("lanlink_guest_name", nickname);
};
