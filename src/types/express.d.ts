import { TokenPayload } from "../core/security/jwt";

declare global {
  namespace Express {
    // On dit à Passport : le type "User" que tu ajoutes à req.user,
    // c'est en fait notre TokenPayload
    interface User extends TokenPayload {}
  }
}

export {};