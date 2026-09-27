# Moje Mapy – instalace na iPhone 13 mini (zdarma, z Windows)

Tento návod tě provede vším od nuly: od GitHubu přes stavbu aplikace v cloudu až po nahrání do iPhonu přes Sideloadly a vývoj s okamžitým načítáním změn z PC.

> **Jak to funguje**
> 1. Kód je na GitHubu. GitHub Actions má zdarma Mac, který z kódu postaví soubor **`.ipa`** (nepodepsaná appka).
> 2. **Sideloadly** na Windows tuto `.ipa` podepíše tvým **bezplatným Apple ID** a nahraje ji do iPhonu.
> 3. S bezplatným Apple ID vyprší podpis po **7 dnech**. Sideloadly ho umí obnovovat automaticky přes Wi-Fi, stačí mít zapnuté PC.

---

## 0. Co budeš potřebovat

| Věc | Poznámka |
| --- | --- |
| Windows PC | máš |
| iPhone 13 mini + kabel USB-C/Lightning | na první instalaci |
| Apple ID | stačí to, co používáš v telefonu (klidně si založ druhé jen na vývoj) |
| GitHub účet | zdarma na <https://github.com/signup> |
| Node.js 22 nebo novější | máš (v24) |

---

## 1. Nahraj projekt na GitHub

1. Na <https://github.com/new> vytvoř repozitář, třeba `moje-mapy`.
   - **Public** = neomezené minuty na macOS buildech.
   - **Private** = cca 2000 minut měsíčně, ale macOS se počítá 10×, takže to dělá zhruba 200 minut, tedy asi 8 až 10 buildů měsíčně. Pro vývoj s dev-clientem (viz krok 6) to bohatě stačí.
2. V této složce spusť v PowerShellu:

   ```powershell
   git add -A
   git commit -m "Moje Mapy"
   git branch -M main
   git remote add origin https://github.com/<tvuj-ucet>/moje-mapy.git
   git push -u origin main
   ```

---

## 2. Postav aplikaci (GitHub Actions)

1. Na GitHubu otevři repozitář, pak záložku **Actions** a workflow **iOS build (unsigned IPA)**.
2. Klikni na **Run workflow** a vyber variantu:
   - **development**: vývojová verze. JavaScript se načítá z tvého PC, takže se změny v kódu projeví okamžitě bez nového buildu. **Na začátek vyber tuto.**
   - **release**: samostatná appka, která funguje i venku bez PC. Tu si nahraj, až budeš chtít jezdit.
3. Build trvá zhruba 20 až 35 minut. Pak dole v běhu najdeš **Artifacts** a v nich `MojeMapy-development`. Stáhni ho a rozbal ZIP, uvnitř je soubor `.ipa`.

> Nový build potřebuješ jen při změně nativních knihoven (`package.json`, `app.json`). Běžné změny v kódu jdou přes Metro (krok 6).

---

## 3. Připrav Windows pro Sideloadly

1. **Odinstaluj** iTunes a iCloud z Microsoft Store, pokud je máš. Sideloadly potřebuje verze **přímo od Applu**:
   - iTunes (64bit): <https://www.apple.com/itunes/download/win64>
   - iCloud: <https://support.apple.com/en-us/103232> (klasický instalátor, ne verze ze Store)
2. Nainstaluj **Sideloadly**: <https://sideloadly.io/>
3. Připoj iPhone kabelem, odemkni ho a na dotaz **Důvěřovat tomuto počítači?** klepni na **Důvěřovat**.
4. Otevři iTunes, klikni na ikonku telefonu a zaškrtni **Synchronizovat s tímto iPhonem přes Wi-Fi**, pak klikni na **Použít**. To je potřeba pro automatickou obnovu přes Wi-Fi.

---

## 4. Nahraj appku do iPhonu

1. Spusť Sideloadly a přetáhni do okna soubor `.ipa`.
2. Nahoře vyber svůj iPhone a do pole **Apple account** napiš svůj Apple ID e-mail.
3. Klikni na **Advanced options** a nastav:
   - **Signing mode**: `Apple ID Sideload`
   - Zaškrtni **Automatically refresh** (Sideloadly pak podpis obnoví sám před vypršením)
   - Bundle ID nech výchozí (`cz.johny.mojemapy`). Kdyby ho Sideloadly odmítl, zaškrtni **Change bundle ID** a dej třeba `cz.tvojejmeno.mojemapy`.
4. Klikni na **Start**, zadej heslo k Apple ID (a případně kód dvoufázového ověření).
5. Na iPhonu:
   - **Nastavení → Soukromí a zabezpečení → Režim pro vývojáře**: zapnout. iPhone se restartuje, po restartu potvrď **Zapnout**. (Položka se objeví až po prvním pokusu o nahrání appky.)
   - **Nastavení → Obecné → Správa VPN a zařízení**: klepni na svůj Apple ID a pak na **Důvěřovat**.
6. Spusť **Moje Mapy** a povol polohu (při výzvě na nahrávání na pozadí zvol **Vždy**).

### Omezení bezplatného Apple ID
- Podpis platí **7 dní**. S „Automatically refresh“ a zapnutým Sideloadly na PC ve stejné Wi-Fi se obnovuje sám. Jinak stačí appku jednou za týden znovu nahrát (data v appce zůstanou).
- Najednou můžeš mít max. **3** takto nahrané appky a vytvořit max. 10 App ID za týden.

---

## 5. Automatická obnova – jak zkontrolovat
- Ikonka Sideloadly v systémové liště musí běžet. Můžeš zapnout, aby se Sideloadly spouštělo po startu Windows.
- iPhone i PC musí být ve stejné Wi-Fi a iPhone odemčený a nabíjený, když obnova proběhne.
- V Sideloadly je v kontextovém menu u zařízení seznam appek s datem vypršení.

---

## 6. Vývoj: změny v kódu hned v telefonu (development build)

1. V této složce vytvoř soubor `.env` (volitelné, viz krok 7):

   ```env
   EXPO_PUBLIC_DATA_BASE_URL=https://pub-xxxxxxxxxxxx.r2.dev
   ```

2. Spusť vývojový server:

   ```powershell
   npm install
   npm start
   ```

3. Při prvním spuštění povol ve Windows Firewallu přístup pro **Node.js** (privátní sítě).
4. iPhone musí být ve **stejné Wi-Fi**. Otevři appku Moje Mapy (development). Zobrazí se Expo Dev Launcher: buď klepni na nalezený server, nebo naskenuj fotoaparátem QR kód z terminálu.
5. Každé uložení souboru se v telefonu projeví během pár sekund. Zatřesením telefonem otevřeš vývojové menu.

> Pokud se telefon nepřipojí (firemní nebo hotelová Wi-Fi), zkus `npx expo start --dev-client --tunnel`.

---

## 7. Offline mapy, tracktype a vrstevnice (datový server R2)

Online podklad (OpenFreeMap), stínování (Terrarium), plánování tras (BRouter) a hledání (Photon) fungují **hned bez nastavení**.

Pro **offline mapy**, **barevné tracktype**, **zákazy vjezdu**, **vrstevnice** a **limity rychlosti** je potřeba jednou nastavit bezplatný Cloudflare R2 a spustit datovou pipeline. Postup je v [DATA_PIPELINE.md](DATA_PIPELINE.md).

Po nastavení:
- na GitHubu v **Settings → Secrets and variables → Actions → Variables** přidej proměnnou `DATA_BASE_URL` s adresou bucketu (pro release buildy),
- lokálně ji dej do `.env` (pro development).

---

## Řešení problémů

| Problém | Řešení |
| --- | --- |
| Sideloadly: „Please install iTunes“ | Máš verzi z Microsoft Store. Odinstaluj ji a nainstaluj verzi z apple.com (krok 3). |
| Sideloadly: „Your maximum App ID limit has been reached“ | Počkej 7 dní nebo použij jiné Apple ID. Nevytvářej zbytečně nová Bundle ID. |
| Appka po týdnu nejde otevřít | Vypršel podpis. Nahraj znovu stejnou `.ipa` přes Sideloadly (data zůstanou). |
| „Untrusted Developer“ | Nastavení → Obecné → Správa VPN a zařízení → Důvěřovat. |
| Dev Launcher nenajde server | Stejná Wi-Fi, povolený Node ve firewallu, případně `--tunnel`. |
| Build na GitHubu selže | Stáhni artifact `build-log` a pošli mi posledních ~100 řádků. |
| Nenahrává na pozadí | iPhone Nastavení → Moje Mapy → Poloha → **Vždy** + zapnout **Přesná poloha**. |
