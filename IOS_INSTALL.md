# Fox VPN for iPhone and iPad

[English](#english) · [فارسی](#فارسی) · [Downloads](https://github.com/erfan-tahvilian/FoxVPN/releases/tag/v1.0.0)

## English

### Read this before downloading

Requires **iOS/iPadOS 18 or later**. Download `FoxVPN-1.0.0-iOS-arm64-unsigned.ipa` from [GitHub Releases](https://github.com/erfan-tahvilian/FoxVPN/releases/tag/v1.0.0). It is a real-device Release build containing the app, VPN Packet Tunnel extension, and Control Center/Live Activity extension. It is **an unsigned signing input, not a directly installable app**. `SHA256SUMS-iOS.txt` contains the release checksums.

Fox VPN needs Apple-authorized Network Extension, App Group and shared Keychain permissions. Writing those names into an entitlements file does not grant them. A working main screen does not prove that the VPN extension can run.

### Which installation methods work?

| Method | Ordinary free Apple Account | Fox VPN status |
| --- | --- | --- |
| AltStore Classic | Signs ordinary apps with personal development provisioning | Does not provide the required Packet Tunnel permission; not a working free VPN installation path. |
| SideStore | Uses personal signing and a separate local VPN helper | Its helper does not grant Fox VPN Network Extension permission; not a working free VPN installation path. |
| Sideloadly, Apple ID signing | Ordinary free signatures have a short validity period | Does not make the restricted VPN permission available to a free account. |
| Authorized signer with device profiles | Tester does not need their own paid membership | Conditional supported signing path: all three targets must be correctly signed and the phone must be eligible. Physical VPN testing remains required. |
| Sideloadly, Normal Install | Installs an already correctly signed IPA | Installation option for a device-eligible signed IPA; it cannot repair missing entitlements. Not physically tested by this project. |
| TrollStore | Uses a version-specific CoreTrust mechanism | Its published supported versions end at iOS 17.0; this iOS 18+ build is incompatible. |
| LiveContainer or generic certificate services | Varies | Not a verified Packet Tunnel installation path for this release. A running UI or a generic P12 is insufficient. |

The seven-day refresh and app limits of free sideloading tools are additional restrictions, not the main obstacle here. Removing the VPN extension or shared permissions would disable essential functionality. Fox VPN does not offer such a reduced build as a successful VPN release.

### If you only have an iPhone

**Without an existing, authorized signing arrangement there is no supported free, computer-free installation route for this release on a standard iPhone.** Opening the unsigned IPA in Files or changing Settings cannot authorize it.

You can ask an authorized signing administrator to sign for your device; the administrator, rather than every tester, supplies the necessary signing credentials. Tell them:

> Please sign Fox VPN including its Packet Tunnel and widget extensions. The app and tunnel must retain `packet-tunnel-provider`; all three targets must share the authorized App Group and Keychain group. My device must be included in every applicable provisioning profile. Please provide a device-eligible signed IPA or an HTTPS OTA installation link.

If the administrator supplies an OTA link, open their HTTPS installation page in Safari and follow the system installation prompts. An eligible phone must already be registered when using registered-device profiles. If the administrator only supplies an IPA, use the computer instructions below or their documented on-device installer. GitHub's ordinary Download button does not perform an OTA installation.

When signing credentials are configured in this repository, automation also generates an OTA manifest alongside the signed IPA. A signing administrator can use that manifest on an HTTPS installation page. This delivery route is conditional and has not been tested on a physical iPhone here.

### If you have a Windows PC or Mac

**Free Apple ID re-signing with AltStore, SideStore or Sideloadly is not enough for this VPN.** First obtain an appropriately signed, device-eligible IPA from an authorized signer, or use the automated signing option below with valid credentials.

For an already signed IPA:

1. Install [Sideloadly from its official website](https://sideloadly.io/), following its device-driver prerequisites.
2. Connect the unlocked iPhone by USB and accept the iPhone's **Trust This Computer** prompt.
3. Select the phone and the **signed** IPA.
4. Use the **Normal Install** mode for an existing signature. Do not switch to free Apple ID signing, remove extensions, alter bundle identifiers, inject libraries, or strip entitlements.
5. Install, then follow the device's relevant Developer Mode or trust prompt if the selected distribution method requires it. A trust prompt cannot fix an invalid profile, unregistered device or missing permission.
6. Open Fox VPN, sign in, connect, and accept the system VPN configuration request. Complete the VPN checks below.

Sideloadly documents Normal Install in its [official changelog](https://sideloadly.io/changelog). This is an installation procedure for a correctly provisioned package, not a claim that this project's physical installation has been tested. Alternatively, an administrator with a Mac can install the signed package using Apple Configurator.

### Sign using GitHub Actions, without owning a Mac

A signer who already has valid Apple signing assets can use the project's macOS runner. This does not require the repository owner or every tester to buy a membership. It does require credentials that actually authorize the VPN and shared storage capabilities.

1. Fork or use a repository you control containing this source.
2. Add the certificate and three device provisioning profiles to **Settings → Secrets and variables → Actions** as described in [the signing guide](ios/BUILDING.md#automatic-signing-in-github-actions).
3. Open **Actions → iOS build → Run workflow**. Select `main`, release tag `v1.0.0`, enable publishing, and select the matching export method. Enable **Require signed output** when you expect a signed package.
4. The workflow validates capabilities, device eligibility, expiration and signing identity before signing. It verifies the actual exported signatures and entitlements again afterward. Invalid or incomplete signing configuration fails the run; it does not silently publish a purportedly working signed VPN.
5. Download `FoxVPN-1.0.0-iOS-arm64-signed.ipa` if that asset was produced. Read `iOS-SIGNING-REPORT.json` for its eligibility count and expiry. Such a file works only for eligible devices and remains subject to certificate/profile validity.

Without signing credentials, Actions publishes the unsigned IPA, requested entitlements, matching source, tools, checksums and this guide. It does not generate fake Apple signatures. Never put Apple Account passwords, P12 private keys or profiles in commits or issues.

### Check the VPN, not just the app

A physical tester must confirm all of the following before reporting success:

- iOS accepts the VPN configuration and the connection reaches Connected.
- Browser and other app traffic work; IPv4/IPv6 results are checked where available.
- DNS works, traffic totals increase, and the connection remains stable in the background and with the screen locked.
- Wi-Fi/cellular changes recover appropriately, and disconnect restores normal access.
- Control Center reflects the actual connection; Live Activity behavior and freshness are checked.

A successful build, a valid signature, an installed icon or the word Connected alone does not establish these results. No physical iPhone is available to this project maintainer for this release. Simulator UI/core checks and package inspection are recorded separately in `iOS-BUILD-INFO.json` and [VALIDATION.md](VALIDATION.md).

### Troubleshooting

| Symptom | Check |
| --- | --- |
| IPA will not install | Unsigned input, expired/revoked signature, unsupported iOS, or device absent from a profile. |
| App opens but VPN cannot start | Packet Tunnel extension omitted or its actual signature lacks the granted Network Extension entitlement. |
| App Group / Keychain error | All targets must share compatible, authorized identifiers; generic bundle-ID replacement is insufficient. |
| Unexpected browser proxy works but system apps fail | This is not proof of full Packet Tunnel operation. Verify real system traffic. |

Optional computer check: extract the signing-tools ZIP and run `python scripts/inspect-ios-ipa.py PATH_TO_IPA`. It checks architecture, resources and extension packaging; it explicitly does **not** validate Apple's signatures or live routing. The signed Actions branch performs the additional native signature checks.

### Primary references

Reviewed 2026-10-21: [Apple capability matrix](https://developer.apple.com/help/account/reference/supported-capabilities-ios/), [Apple guidance on personal provisioning and Network Extension](https://developer.apple.com/forums/thread/128767), [AltStore Classic](https://faq.altstore.io/altstore-classic/your-altstore), [SideStore FAQ](https://docs.sidestore.io/docs/faq), [Sideloadly FAQ](https://sideloadly.io/faq.html), [Sideloadly changelog](https://sideloadly.io/changelog), [TrollStore supported versions](https://github.com/opa334/TrollStore#readme), [LiveContainer](https://github.com/LiveContainer/LiveContainer).

---

## فارسی

<div dir="rtl">

### پیش از دانلود

این نسخه به **iOS یا iPadOS نسخهٔ ۱۸ یا جدیدتر** نیاز دارد. فایل `FoxVPN-1.0.0-iOS-arm64-unsigned.ipa` را از [ریلیز گیت‌هاب](https://github.com/erfan-tahvilian/FoxVPN/releases/tag/v1.0.0) دریافت کنید. این خروجی Release مخصوص دستگاه واقعی است و اپ اصلی، افزونهٔ VPN و افزونهٔ Control Center و Live Activity را دارد؛ اما **بدون امضاست و مستقیماً نصب نمی‌شود**. فایل `SHA256SUMS-iOS.txt` برای بررسی سلامت دانلود است.

فاکس وی‌پی‌ان به مجوز معتبر اپل برای Network Extension، App Group و Keychain مشترک نیاز دارد. افزودن نام این مجوزها به یک فایل، آن‌ها را فعال نمی‌کند. بازشدن صفحهٔ برنامه نیز به معنی کارکرد VPN نیست.

### نتیجهٔ بررسی روش‌ها

| روش | نتیجه برای این نسخه |
| --- | --- |
| امضای رایگان با AltStore Classic | مجوز لازم برای Packet Tunnel را فراهم نمی‌کند؛ راه نصب VPN فعال نیست. |
| امضای رایگان با SideStore | VPN کمکی خود SideStore، مجوزی به Fox VPN نمی‌دهد؛ راهکار موفق برای این اپ نیست. |
| امضای رایگان Apple ID در Sideloadly | مشکل مجوز VPN را برطرف نمی‌کند؛ تمدید هفت‌روزه نیز این محدودیت را حل نمی‌کند. |
| امضاکنندهٔ مجاز با پروفایل دستگاه | مسیر قابل بررسی است؛ هر سه بخش برنامه باید درست امضا شوند و گوشی مجاز باشد. تست واقعی همچنان لازم است. |
| حالت Normal Install در Sideloadly | برای نصب IPA از قبل درست امضاشده است؛ مجوز ناقص را اصلاح نمی‌کند. روی آیفون واقعی این پروژه تست نشده است. |
| ابزار TrollStore | نسخه‌های پشتیبانی‌شدهٔ منتشرشدهٔ آن تا iOS 17.0 هستند؛ این بیلد iOS 18+ با آن سازگار نیست. |
| ابزار LiveContainer یا گواهی عمومی ناشناس | برای اجرای Packet Tunnel این نسخه تأیید نشده‌اند؛ صرف بازشدن رابط یا داشتن فایل P12 کافی نیست. |

### اگر فقط آیفون دارید

**بدون دسترسی به یک امضاکنندهٔ مجاز، راه رایگان و تأییدشده‌ای برای نصب این نسخه روی آیفون عادی، بدون کامپیوتر، ارائه نمی‌شود.** بازکردن IPA بدون امضا در Files یا تغییر تنظیمات گوشی، این محدودیت را برطرف نمی‌کند.

لازم نیست هر تست‌کننده حساب پولی خودش را داشته باشد؛ یک امضاکنندهٔ مجاز می‌تواند خروجی مناسب همان گوشی را آماده کند. این متن را برای او بفرستید:

> لطفاً Fox VPN را با هر دو افزونه‌اش امضا کنید. اپ و افزونهٔ VPN باید مجوز packet-tunnel-provider داشته باشند و هر سه بخش، App Group و Keychain مشترکِ مجاز داشته باشند. گوشی من باید در تمام پروفایل‌های لازم ثبت باشد. لطفاً IPA امضاشدهٔ مناسب گوشی یا لینک نصب OTA روی HTTPS بدهید.

اگر لینک نصب OTA دریافت کردید، صفحهٔ نصب HTTPS را در Safari باز کنید و مراحل سیستم را دنبال کنید. در روش دستگاه‌های ثبت‌شده، گوشی باید از قبل در پروفایل‌ها مجاز شده باشد. اگر فقط IPA امضاشده دارید، از روش کامپیوتر یا نصب‌کنندهٔ مستند همان امضاکننده استفاده کنید. دکمهٔ Download گیت‌هاب، نصب OTA انجام نمی‌دهد.

در صورت تنظیم گواهی‌های معتبر، workflow فایل manifest نصب OTA را نیز تولید می‌کند تا امضاکننده بتواند آن را روی صفحهٔ نصب HTTPS استفاده کند. این مسیر تحویل هنوز روی آیفون واقعی پروژه آزمایش نشده است.

### اگر ویندوز یا مک دارید

امضای معمولی با Apple Account رایگان در AltStore، SideStore یا Sideloadly برای VPN این برنامه کافی نیست. ابتدا IPA معتبرِ مناسب گوشی را از امضاکننده بگیرید یا از امضای خودکار با گواهی‌های معتبر استفاده کنید.

۱. نرم‌افزار [Sideloadly را از سایت رسمی](https://sideloadly.io/) نصب و پیش‌نیازهای درایور آن را دنبال کنید.

۲. آیفون بازشده را با USB وصل کنید و پیام Trust This Computer را تأیید کنید.

۳. گوشی و فایل **IPA امضاشده** را انتخاب کنید.

۴. حالت **Normal Install** را برای نصب با امضای موجود انتخاب کنید. امضا را با Apple ID رایگان جایگزین نکنید؛ افزونه‌ها یا مجوزها را حذف نکنید و شناسهٔ برنامه را تغییر ندهید.

۵. نصب را انجام دهید. اگر روش امضای انتخاب‌شده به Developer Mode یا تأیید اعتماد نیاز داشت، پیام مربوط را دنبال کنید. گزینهٔ Trust، گواهی نامعتبر یا مجوز حذف‌شده را تعمیر نمی‌کند.

۶. برنامه را باز کنید، وارد حساب شوید، اتصال را بزنید و اجازهٔ افزودن VPN را تأیید کنید. سپس تست‌های پایین را انجام دهید.

این روش نصبِ یک بستهٔ درست امضاشده است و به معنی تأیید نصب واقعی توسط پروژه نیست. امضاکنندهٔ دارای مک می‌تواند از Apple Configurator هم استفاده کند.

### امضای خودکار بدون داشتن مک شخصی

امضاکننده‌ای که گواهی و سه پروفایل معتبر دارد می‌تواند از runner مک در GitHub Actions استفاده کند. داشتن صرفاً Apple Account رایگان، جای این مجوزها را نمی‌گیرد.

۱. ریپوی خودتان یا یک Fork از پروژه را باز کنید و طبق [راهنمای فنی امضا](ios/BUILDING.md#automatic-signing-in-github-actions)، کلید و سه پروفایل را در بخش Secrets تنظیم کنید.

۲. در بخش Actions، workflow با نام **iOS build** را باز کنید و Run workflow را بزنید. شاخهٔ main، تگ v1.0.0 و انتشار خروجی را انتخاب کنید. نوع export باید با پروفایل‌ها تطابق داشته باشد. برای الزام خروجی امضاشده، Require signed output را روشن کنید.

۳. ابتدا مجوزها، دستگاه‌های مشترک، تاریخ انقضا و گواهی بررسی می‌شوند؛ پس از export نیز امضا و مجوزهای واقعی هر سه بخش بررسی می‌شوند. تنظیم ناقص باعث شکست ساخت می‌شود.

۴. اگر فایل `FoxVPN-1.0.0-iOS-arm64-signed.ipa` تولید شد، آن را دریافت کنید و گزارش `iOS-SIGNING-REPORT.json` را ببینید. این نسخه فقط برای دستگاه‌های مجاز و تا زمان اعتبار امضا قابل استفاده است.

اگر گواهی‌ها موجود نباشند، خروجی بدون امضا همراه راهنما، سورس مطابق، ابزارها، مجوزهای موردنیاز و checksum منتشر می‌شود. هیچ امضای ساختگی تولید نمی‌شود. اطلاعات Apple Account، کلید خصوصی یا پروفایل‌ها را در کد، Issue یا پیام عمومی قرار ندهید.

### تست واقعی VPN

تست‌کننده باید افزودن تنظیمات VPN، اتصال واقعی و کارکرد اینترنت در مرورگر و اپ‌های دیگر، DNS، IPv4 و IPv6 در صورت وجود، افزایش آمار ترافیک، پایداری در پس‌زمینه و قفل صفحه، تغییر Wi-Fi و اینترنت همراه و برگشت اینترنت عادی پس از قطع را بررسی کند. وضعیت Control Center و تازه‌بودن اطلاعات Live Activity هم باید بررسی شوند.

بیلد موفق، امضای معتبر، آیکون نصب‌شده یا حتی متن Connected به‌تنهایی اثبات کارکرد VPN نیستند. تست روی آیفون واقعی در دسترس توسعه‌دهنده نبوده است. نتیجهٔ آزمون‌های هسته، رابط شبیه‌ساز و بسته‌بندی در `iOS-BUILD-INFO.json` و [گزارش بررسی‌ها](VALIDATION.md) جدا ثبت شده‌اند.

اگر نصب رد شد، اعتبار امضا، نسخهٔ iOS و ثبت گوشی در تمام پروفایل‌ها را بررسی کنید. اگر برنامه باز شد ولی VPN کار نکرد، وجود افزونه و مجوز واقعی Packet Tunnel و همچنین App Group و Keychain مشترک را بررسی کنید. منابع رسمی بررسی روش‌ها در بخش انگلیسی همین سند آمده‌اند.

</div>
