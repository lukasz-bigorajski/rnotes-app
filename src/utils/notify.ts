import { notifications } from "@mantine/notifications";

export function notifyError(title: string, message: string) {
  notifications.show({
    title,
    message,
    color: "red",
    autoClose: 5000,
  });
}

export function notifySuccess(title: string, message: string) {
  notifications.show({
    title,
    message,
    color: "green",
    autoClose: 3000,
  });
}

export function notifyWarning(title: string, message: string) {
  notifications.show({
    title,
    message,
    color: "yellow",
    autoClose: 4000,
  });
}
