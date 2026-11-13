const encoder = new TextEncoder();
export async function hashPin(pin: string, salt: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(salt + ":" + pin));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export async function savePin(user: string, pin: string) {
  if (!/^\d{4}$/.test(pin)) throw new Error("PIN 4 rakam olmalı");
  const salt = crypto.randomUUID();
  localStorage.setItem(
    "saha-lock:" + user,
    JSON.stringify({ salt, hash: await hashPin(pin, salt) }),
  );
}
export async function verifyPin(user: string, pin: string) {
  const data = JSON.parse(localStorage.getItem("saha-lock:" + user) ?? "null");
  return Boolean(data && (await hashPin(pin, data.salt)) === data.hash);
}
function bufferFromB64(s: string) {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}
export async function registerBiometric(user: string) {
  if (!window.PublicKeyCredential) throw new Error("Bu cihaz biyometrik kilidi desteklemiyor");
  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: "Saha", id: location.hostname },
      user: { id: encoder.encode(user), name: user, displayName: "Saha" },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
      timeout: 60000,
    },
  })) as PublicKeyCredential | null;
  if (!credential) throw new Error("Cihaz doğrulaması tamamlanmadı");
  localStorage.setItem(
    "saha-biometric:" + user,
    btoa(String.fromCharCode(...new Uint8Array(credential.rawId))),
  );
}
export async function verifyBiometric(user: string) {
  const id = localStorage.getItem("saha-biometric:" + user);
  if (!id) return false;
  const cred = await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rpId: location.hostname,
      allowCredentials: [{ type: "public-key", id: bufferFromB64(id) }],
      userVerification: "required",
      timeout: 60000,
    },
  });
  return Boolean(cred);
}
