// =====================================================================
//  ZUGANG für „Ergebnisse bearbeiten“
// =====================================================================
//  Enthält den GitHub-Token, verschlüsselt mit dem Bearbeiten-Passwort
//  (AES-256-GCM, Schlüssel per PBKDF2 aus dem Passwort abgeleitet).
//  Ohne das Passwort ist der Token nicht lesbar.
//  Nicht von Hand ändern. Neu erzeugen über „Zugang neu einrichten“.
// =====================================================================

const ZUGANG = {
  "v": 1,
  "repo": "itzkiili/Mini-PDC_Premier_League",
  "branch": "main",
  "iter": 600000,
  "salt": "XitX8gwllaCktpSXdpnOxw==",
  "iv": "4QW+guLlARCYNVEJ",
  "data": "3CX4TlYlYnhHsdO5YtA++LWUKZq6LfSFA/wY/PxYUa5/aDdyf8zoNPd/o6VXqmF5Jeu50sfB8wMP1yHWDmgk0Vsb2yrgPcmZrPvtGb0WgloEHpzA6bawSApck3KFOr6RRxB2dLY0805cE84ic0HwL7QjpBwEOnHYzA=="
};
