import { Config } from "./config";

const password = "1122";

class AuthServiceClass {
    public chatId: number | undefined;

    public TryAuth(pswd: string, chatId: number): boolean
    {
        if (Config.AllowedChats.includes(chatId)) {
            return true;
        }

        if (pswd === password) {
            this.chatId = chatId;
            return true;
        }
        return false;
    }

    public ResetAuth() {
        this.chatId = undefined;
    }

    public CheckAuth(chatId: number)
    {
        if (Config.AllowedChats.includes(chatId)) {
            return true;
        }
        return this.chatId === chatId;
    }
}

export const AuthService = new AuthServiceClass();
