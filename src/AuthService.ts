const password = "1122";

class AuthServiceClass {
    public chatId: number | undefined;

    public TryAuth(pswd: string, chatId: number): boolean {
        if (pswd === password) {
            this.chatId = chatId;
            return true;
        }
        return false;
    }

    public ResetAuth() {
        this.chatId = undefined;
    }

    public CheckAuth(chatId: number) {
        return this.chatId === chatId;
    }

    public HasAuth() {
        return this.chatId !== undefined;
    }
}

export const AuthService = new AuthServiceClass();
