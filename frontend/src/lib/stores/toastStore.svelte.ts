type Toast = {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
};

class ToastStore {
  toasts = $state<Toast[]>([]);

  show(toast: Omit<Toast, 'id'>) {
    const id = crypto.randomUUID();
    this.toasts.push({ ...toast, id });

    if (toast.duration !== 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, toast.duration || 5000);
    }
  }

  dismiss(id: string) {
    this.toasts = this.toasts.filter((t) => t.id !== id);
  }

  addToast(message: string, type: Toast['type'] = 'info', duration?: number) {
    this.show({ type, message, duration });
  }

  success(message: string, duration?: number) {
    this.show({ type: 'success', message, duration });
  }

  error(message: string, duration?: number) {
    this.show({ type: 'error', message, duration });
  }

  warning(message: string, duration?: number) {
    this.show({ type: 'warning', message, duration });
  }

  info(message: string, duration?: number) {
    this.show({ type: 'info', message, duration });
  }
}

export const toastStore = new ToastStore();
