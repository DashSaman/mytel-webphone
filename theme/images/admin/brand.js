/* MyTel brand + Persian localization layer for the IssabelPBX admin console.
   Presentation only: text-node swaps (TreeWalker), attribute placeholders,
   help-tooltip translation, technical-input LTR marking, document direction.
   No innerHTML blanket replacement, no value/name/id changes. */
(function () {
    "use strict";

    /* ---------- true RTL ---------- */
    var doc = document.documentElement;
    doc.setAttribute("dir", "rtl");
    doc.setAttribute("lang", "fa");

    /* ---------- brand (run first) ---------- */
    var BRAND = {
        "IssabelPBX": "MyTel PBX", "Issabel PBX": "MyTel PBX",
        "Issabel Foundation": "MyTel", "FreePBX": "MyTel PBX",
        "Issabel": "MyTel", "Elastix": "MyTel"
    };

    /* ---------- full-sentence map (matched before word swaps, normalized) ----
       Sentences the word-swapper would otherwise shred ("Add an Extension") */
    var SENTENCES = {
        "add an extension": "افزودن داخلی",
        "add a extension": "افزودن داخلی",
        "add new extension": "افزودن داخلی",
        "add sip extension": "افزودن داخلی SIP",
        "add pjsip extension": "افزودن داخلی PJSIP",
        "add iax2 extension": "افزودن داخلی IAX2",
        "add custom extension": "افزودن داخلی سفارشی",
        "add trunk": "افزودن ترانک",
        "add a trunk": "افزودن ترانک",
        "add new trunk": "افزودن ترانک",
        "add sip trunk": "افزودن ترانک SIP",
        "add pjsip trunk": "افزودن ترانک PJSIP",
        "add custom trunk": "افزودن ترانک سفارشی",
        "add dav trunk": "افزودن ترانک DAV",
        "add dundi trunk": "افزودن ترانک DUNDi",
        "add inbound route": "افزودن مسیر ورودی",
        "add outbound route": "افزودن مسیر خروجی",
        "add a route": "افزودن مسیر",
        "add queue": "افزودن صف تماس",
        "add ring group": "افزودن گروه زنگ",
        "add announcement": "افزودن اطلاعیهٔ صوتی",
        "add conference": "افزودن کنفرانس",
        "add time condition": "افزودن شرط زمانی",
        "add user": "افزودن کاربر",
        "please select your device below then click submit": "دستگاه موردنظر را انتخاب کنید و سپس دکمهٔ ذخیره را بزنید.",
        "please select your device below then click": "دستگاه موردنظر را انتخاب کنید و سپس دکمهٔ ذخیره را بزنید.",
        "delete this extension": "حذف این داخلی",
        "are you sure you want to delete this": "از حذف این مورد مطمئن هستید؟",
        "you have made changes to this form": "در این فرم تغییراتی ایجاد کرده‌اید.",
        "click here to apply them": "برای اعمال تغییرات اینجا کلیک کنید",
        "no such file or directory": "فایل یا مسیر یافت نشد",
        "the following modules are disabled because they need to be upgraded": "ماژول‌های زیر برای ارتقا نیاز دارند و غیرفعال شده‌اند",
        "you have installed new modules": "ماژول‌های جدیدی نصب کرده‌اید.",
        "please run": "لطفاً اجرا کنید:",
        "operating system": "سیستم‌عامل",
        "reload required": "بارگذاری مجدد لازم است",
        "apply changes bar": "نوار اعمال تغییرات",
        "you have made changes": "تغییراتی ایجاد کرده‌اید",
        "when you are done making changes": "پس از پایان تغییرات",
        "you can": "می‌توانید",
        "no notices": "اعلانی وجود ندارد",
        "welcome to": "خوش آمدید به",
        "there are no extensions": "هیچ داخلی ثبت نشده است",
        "please create an extension": "لطفاً یک داخلی بسازید"
    };

    /* ---------- Persian UI dictionary (word-boundary, longest first) ----------
       Technical terms intentionally kept: PBX, SIP, PJSIP, RTP, NAT, TLS,
       Caller ID, IVR, DISA, CPU, Swap, codec names, Asterisk contexts... */
    var FA = {
        /* top navigation */
        "Apply Config": "اعمال تنظیمات",
        "Applications": "برنامه‌ها",
        "Connectivity": "ارتباطات",
        "Reports": "گزارش‌ها",
        "Settings": "تنظیمات",
        "Other": "سایر",
        "Admin": "مدیریت",
        /* dashboard panels */
        "MyTel PBX System Status": "وضعیت مرکز تلفن MyTel",
        "MyTel PBX Notices": "اعلان‌های مرکز تلفن MyTel",
        "MyTel PBX Statistics": "آمار مرکز تلفن MyTel",
        "System Statistics": "آمار سیستم",
        "System Status": "وضعیت سیستم",
        "PBX Notices": "اعلان‌های مرکز تلفن",
        "PBX Statistics": "آمار مرکز تلفن",
        "Processor": "پردازنده",
        "Load Average": "میانگین بار سیستم",
        "Memory": "حافظه",
        "Disks": "دیسک‌ها",
        "Total active calls": "مجموع تماس‌های فعال",
        "Internal calls": "تماس‌های داخلی",
        "External calls": "تماس‌های خارجی",
        "Total active channels": "مجموع کانال‌های فعال",
        "Total active channels:": "مجموع کانال‌های فعال:",
        "show all": "نمایش همه",
        "Uptime:": "مدت کار:",
        /* notices / errors (technical id preserved in parentheses) */
        "retrieve_conf failed, config not applied": "خطا در دریافت پیکربندی؛ تنظیمات اعمال نشد (retrieve_conf failed)",
        "Symlink Conflict Resolved": "تداخل Symlink برطرف شد.",
        "No email address for online update checks": "برای بررسی به‌روزرسانی‌ها، آدرس ایمیل ثبت نشده است.",
        "Please update your notifications email address": "آدرس ایمیل اعلان‌ها را در تنظیمات وارد کنید.",
        /* common actions */
        "Apply Changes": "اعمال تغییرات",
        "Save Changes": "ذخیره تغییرات",
        "Submit": "ذخیره",
        "Submit Changes": "ذخیره تغییرات",
        "Delete": "حذف",
        "Cancel": "انصراف",
        "Reset": "بازنشانی",
        "Edit": "ویرایش",
        "Back": "بازگشت",
        "Search": "جستجو",
        "Refresh": "بازخوانی",
        "Download": "دریافت",
        "Upload": "بارگذاری",
        "Close": "بستن",
        "Install": "نصب",
        "Uninstall": "حذف نصب",
        "Enable": "فعال‌سازی",
        "Disable": "غیرفعال‌سازی",
        "Continue": "ادامه",
        "Duplicate": "کپی",
        "Quick Create Extension": "ایجاد سریع داخلی",
        /* rnav / module names */
        "Batch of Extensions": "ایجاد گروهی داخلی",
        "Asterisk SIP Settings": "تنظیمات SIP آستریس",
        "SIP Settings": "تنظیمات SIP",
        "SIP Custom": "تنظیمات SIP (سفارشی)",
        "General Settings": "تنظیمات عمومی",
        "Advanced Settings": "تنظیمات پیشرفته",
        "Module Admin": "مدیریت ماژول‌ها",
        "Inbound Routes": "مسیرهای ورودی",
        "Outbound Routes": "مسیرهای خروجی",
        "Ring Groups": "گروه‌های زنگ",
        "Time Conditions": "شرایط زمانی",
        "Time Groups": "گروه‌های زمانی",
        "Call Recording": "ضبط تماس",
        "System Recordings": "فایل‌های صوتی سیستم",
        "Music on Hold": "موسیقی انتظار",
        "Feature Codes": "کدهای ویژه",
        "Feature Code Admin": "مدیریت کدهای ویژه",
        "Parking Lot": "پارک تماس",
        "Caller ID Lookup": "جستجوی Caller ID",
        "Blacklist": "لیست سیاه",
        "Phonebook Directory": "دفترچه تلفن",
        "Directory": "دفترچه تلفن",
        "Announcements": "اطلاعیه‌های صوتی",
        "Conferences": "کنفرانس‌ها",
        "Queues": "صف‌های تماس",
        "Extensions": "داخلی‌ها",
        "Trunks": "ترانک‌ها",
        "Recordings": "ضبط‌ها",
        "Voicemail": "صندوق صوتی",
        "Users": "کاربران",
        "Dashboard": "میز کار",
        "Extension": "داخلی",
        "Trunk": "ترانک",
        "Queue": "صف تماس",
        "Ring Group": "گروه زنگ",
        "Announcement": "اطلاعیه صوتی",
        "Conference": "کنفرانس",
        /* more nav dropdown items */
        "CDR Reports": "گزارش CDR",
        "Asterisk CDR Reports": "گزارش CDR آستریس",
        "CDR": "CDR",
        "Call Detail Records": "جزئیات تماس‌ها (CDR)",
        "Call Records": "رکوردهای تماس",
        "CSV Reports": "گزارش‌های CSV",
        "Asterisk Log Files": "فایل‌های لاگ آستریس",
        "Call Event Logging": "ثبت رخدادهای تماس",
        "Asterisk Info": "اطلاعات آستریس",
        "Asterisk CLI": "خط فرمان آستریس",
        "File Backup": "پشتیبان فایل‌ها",
        "User Management": "مدیریت کاربران",
        "Voicemail Admin": "مدیریت صندوق صونی",
        "Speed Dial": "شماره‌گیری سریع",
        "Paging and Intercom": "پیجینگ و آی‌کام",
        "Print Call Logs": "چاپ گزارش تماس‌ها",
        "Call Forward": "گردش تماس",
        "Follow Me": "پیگیری تماس",
        "Day Night": "روز/شب",
        "Do Not Disturb": "مزاحم نشوید (DND)",
        "Concurrency": "تماس‌های همزمان",
        "Contact Manager": "مدیریت مخاطبین",
        "Notices": "اعلان‌ها",
        "Statistics": "آمار",
        "Status": "وضعیت",
        "Advanced": "پیشرفته",
        "Basic": "پایه",
        "Password": "گذرواژه",
        /* device/tech selects (extension form) */
        "Generic PJSIP Device": "دستگاه عمومی PJSIP",
        "Generic SIP Device": "دستگاه عمومی SIP",
        "PJSIP WebRTC Device": "دستگاه WebRTC با PJSIP",
        "Generic IAX2 Device": "دستگاه عمومی IAX2",
        "Generic DAHDi Device": "دستگاه عمومی DAHDi",
        "None (virtual exten)": "هیچ‌کدام (داخلی مجازی)",
        "Custom Device": "دستگاه سفارشی",
        "Other (Custom) Device": "دستگاه سایر (سفارشی)",
        "Device": "دستگاه",
        "Device Type": "نوع دستگاه",
        /* form words */
        "Destination": "مقصد",
        "Dial Patterns": "الگوهای شماره‌گیری",
        "Dial Pattern": "الگوی شماره‌گیری",
        "Description": "شرح",
        "Enabled": "فعال",
        "Disabled": "غیرفعال",
        "Display Name": "نام نمایشی",
        "Secret": "گذرواژه",
        "Add": "افزودن",
        "Save": "ذخیره",
        "yes": "بله",
        "no": "خیر",
        "never": "هرگز",
        "always": "همیشه",
        "Default": "پیش‌فرض",
        "None": "هیچ‌کدام",
        "Other": "سایر",
        "Default Language": "زبان پیش‌فرض",
        "Codecs": "کدک‌ها",
        "Audio Codecs": "کدک‌های صوتی",
        "Video Codecs": "کدک‌های تصویری",
        "Video Settings": "تنظیمات تصویر",
        "RTP Settings": "تنظیمات RTP",
        "SIP Settings": "تنظیمات SIP",
        "NAT Settings": "تنظیمات NAT",
        "Other SIP Settings": "سایر تنظیمات SIP",
        "Registration Settings": "تنظیمات ثبت‌نام",
        "Jitterbuffer Settings": "تنظیمات بافر نوسان",
        "Subscription Settings": "تنظیمات اشتراک",
        "Public IP": "IP عمومی",
        "Static IP": "IP ثابت",
        "Dynamic IP": "IP پویا",
        "External IP": "IP خارجی",
        "External Host": "میزبان خارجی",
        "Local Networks": "شبکه‌های محلی",
        "Local Network": "شبکهٔ محلی",
        "External Address Refresh Rate": "نرخ نوسازی آدرس خارجی",
        "RTP Port Ranges": "بازهٔ پورت‌های RTP",
        "Video Max Bitrate": "حداکثر بیت‌ریت تصویر",
        "DTMF Signaling": "سیگنالینگ DTMF",
        "Codecs and Audio": "کدک‌ها و صدا",
        "Nat Settings": "تنظیمات NAT",
        "Nat Mode": "حالت NAT",
        "IP Configuration": "پیکربندی IP",
        "T.38 Fax": "فکس T.38",
        "SDP Manipulation": "دستکاری SDP",
        "SIP DTMF Mode": "حالت DTMF در SIP",
        "SIP Transport": "انتقال SIP",
        "Drag to re-order": "برای تغییر ترتیب بکشید",
        /* context / words seen in tables */
        "Action": "عملیات",
        "Active": "فعال",
        "Inactive": "غیرفعال",
        "Online": "برخط",
        "Offline": "خارج از خط",
        "Registered": "ثبت‌شده",
        "Unregistered": "ثبت‌نشده",
        "Channel": "کانال",
        "Channels": "کانال‌ها",
        "Context": "کانتکست (زمینهٔ شماره‌گیری)",
        "Caller ID": "شناسهٔ تماس‌گیرنده",
        "Direct Dial": "شماره‌گیری مستقیم",
        "Voicemail Enabled": "صندوق صوتی فعال",
        "requiring additional configuration": "نیازمند پیکربندی بیشتر",
        "Upgrade all": "ارتقای همه",
        "Upgrade": "ارتقا",
        "Download all": "دریافت همه",
        "Install all": "نصب همه",
        "Process": "پردازش",
        "Confirm": "تأیید",
        /* ---- parameter labels seen across module forms (round-14 walk) ---- */
        "Administration": "مدیریت",
        "User": "کاربر",
        "General Options": "تنظیمات عمومی",
        "Dial patterns wizards": "جادوگر الگوهای شماره‌گیری",
        "Dial Patterns Wizards": "جادوگر الگوهای شماره‌گیری",
        "Intra-Company": "درون‌شرکتی",
        "Emergency": "اضطراری",
        "Permanent Route": "مسیر همیشگی",
        "Wait Time Prefix": "پیشوند زمان انتظار",
        "Skip Busy Agents": "پرش از عوامل مشغول",
        "When No Free Agents": "وقتی عامل آزاد نیست",
        "When No Ready Agents": "وقتی عامل آماده نیست",
        "Select an option": "یک گزینه انتخاب کنید",
        "Incoming Route": "مسیر ورودی",
        "CID Priority Route": "مسیر اولویت CID",
        "Pause Before Answer": "مکث پیش از پاسخ",
        "Remove a number from the blacklist": "حذف شماره از لیست سیاه",
        "Add a number to the blacklist": "افزودن شماره به لیست سیاه",
        "Off": "خاموش",
        "On": "روشن",
        "Restrict Dynamic Agents": "محدودکردن عوامل پویا",
        "Agent Restrictions": "محدودیت عامل",
        "Ring-Group Number": "شمارهٔ گروه زنگ",
        "Ring Group Number": "شمارهٔ گروه زنگ",
        "Play Music On Hold": "پخش موسیقی انتظار",
        "Play music on hold": "پخش موسیقی انتظار",
        "Too-Late Announce": "اطلاعیهٔ دیرهنگام",
        "IVR General Options": "تنظیمات عمومی منوی صوتی",
        "IVR Options (DTMF)": "گزینه‌های منوی صوتی (DTMF)",
        "Invalid Retry Recording": "فایل صوتی تلاش مجدد برای ورودی نامعتبر",
        "Talker Optimization": "بهینه‌سازی گوینده",
        "Talker Detection": "تشخیص گوینده",
        "Maximum Participants": "حداکثر شرکت‌کنندگان",
        "Dialplan Behavior": "رفتار دیال‌پلن",
        "Timezone Definitions": "تعاریف منطقهٔ زمانی",
        "Number of Accounts": "تعداد حساب‌ها",
        "Starting Position": "موقعیت شروع",
        "Parking Timeout (seconds)": "مهلت پارک تماس (ثانیه)",
        "Parked Music Class": "کلاس موسیقی تماس‌های پارک‌شده",
        "Parking Lot Extension": "داخلی پارک تماس",
        "Streaming Category": "دستهٔ پخش جریانی",
        "Time Condition name": "نام شرط زمانی",
        "Time Condition Name": "نام شرط زمانی",
        "Select a Group": "یک گروه را انتخاب کنید",
        "Asterisk Dial Options": "گزینه‌های شماره‌گیری آستریس",
        "Internal Auto Answer": "پاسخ خودکار داخلی",
        "Assigned DID/CID": "DID/CID اختصاص‌یافته",
        "Announcement": "اطلاعیهٔ صوتی",
        "Announcements": "اطلاعیه‌های صوتی",
        "Feature Codes": "کدهای ویژه",
        "Feature Code": "کد ویژه",
        "code": "کد",
        "Description...": "شرح...",
        /* ---- module names from the console navigation map ---- */
        "Boss Secretary": "مدیر و منشی (Boss Secretary)",
        "Callback": "تماس بازگشتی",
        "Call Flow Control": "کنترل جریان تماس",
        "Dialplan Injection": "تزریق دیال‌پلن",
        "Dynamic Features": "امکانات پویا",
        "Dynamic Routes": "مسیرهای پویا",
        "Languages": "زبان‌ها",
        "Misc Applications": "برنامه‌های متفرقه",
        "Misc Destinations": "مقاصد متفرقه",
        "PIN Sets": "مجموعه‌های PIN",
        "Set CallerID": "تنظیم Caller ID",
        "Text To Speech": "تبدیل متن به گفتار",
        "Text To Speech Engine": "موتور تبدیل متن به گفتار",
        "Print Extensions": "چاپ داخلی‌ها",
        "Weak Password Detection": "تشخیص گذرواژهٔ ضعیف",
        "Route Congestion Messages": "پیام‌های شلوغی مسیر",
        "Voicemail Blasting": "ارسال گروهی صندوق صوتی",
        "Queue Priorities": "اولویت صف تماس",
        "Extension Settings": "تنظیمات داخلی",
        "Trunk Balance": "توازن ترانک‌ها",
        "Write In Queue Log": "ثبت در لاگ صف",
        "Custom Destinations": "مقاصد سفارشی",
        "Custom Extensions": "داخلی‌های سفارشی",
        "CallerID Lookup Sources": "منابع جستجوی Caller ID",
        "DAHDI Channel DIDs": "DIDهای کانال DAHDI",
        "Class Of Service": "کلاس خدمات (COS)",
        "Paging And Intercom": "پیجینگ و آی‌کام",
        "Asterisk IAX Settings": "تنظیمات IAX آستریس",
        "Asterisk Manager Settings": "تنظیمات مدیر آستریس",
        "Asterisk Logfiles": "فایل‌های لاگ آستریس",
        "Asterisk PJSIP Settings": "تنظیمات PJSIP آستریس",
        "Inbound Routes": "مسیرهای ورودی"
    };

    /* dynamic sentence patterns */
    var PATTERNS = [
        [/There are (\d+) modules available for online upgrades?/g, function (m, n) {
            return n + " ماژول برای به‌روزرسانی در دسترس است.";
        }],
        [/(\d+) modules may be upgraded/g, function (m, n) { return n + " ماژول قابل به‌روزرسانی است"; }],
        [/You have (\d+) new message/g, function (m, n) { return n + " پیام جدید دارید"; }],
        [/connected to Asterisk (\S+) currently running/g, function (m, v) { return "متصل به آستریس " + v + " — در حال اجرا"; }]
    ];

    /* ---------- help-tooltip translations ("?" marks) ----------
       Keys = normalized English prefix (lowercase, isolate marks stripped).
       Style: 1–2 short sentences; identifiers (Asterisk/RTP/BLF/FQDN) kept;
       (asterisk: xxx) hints preserved verbatim; Persian punctuation. */
    var HELP = {
        /* --- NAT / connectivity --- */
        "asterisk nat setting: yes = always": "تنظیم NAT در آستریس: بله = همیشه در نظر گرفتن NAT؛ خیر = فقط طبق RFC3581؛ هرگز = عدم استفاده از NAT و RFC3581؛ route = فرض NAT بدون ارسال rport.",
        "indicate whether the box has": "مشخص می‌کند سرور IP عمومی دارد یا به تنظیمات NAT نیاز دارد؛ معادل پیکربندی خودکار sip_nat.conf.",
        "external static ip or fqdn": "آدرس IP ثابت خارجی یا نام دامنهٔ کامل (FQDN)، همان‌طور که از سمت WAN روتر دیده می‌شود. (asterisk: externip)",
        "external fqdn as seen on": "نام دامنهٔ خارجی که به‌صورت پویا به‌روز می‌شود؛ مانند mydomain.dyndns.com. (asterisk: externhost)",
        "asterisk: externrefresh. how often": "فاصلهٔ جست‌وجو و نوسازی FQDN میزبان خارجی، بر حسب ثانیه. (asterisk: externrefresh)",
        "local network settings (asterisk": "شبکه‌های محلی به شکل ip/mask مانند 192.168.1.0/255.255.255.0. برای هر زیرشبکهٔ اضافه از دکمهٔ افزودن شبکهٔ محلی استفاده کنید؛ فیلدهای خالی هنگام ذخیره حذف می‌شوند. (asterisk: localnet)",
        /* --- codecs --- */
        "check the desired codecs, all": "کدک‌های موردنظر را انتخاب کنید؛ سایر کدک‌ها غیرفعال می‌شوند مگر آنکه در تنظیمات دستگاه یا ترانک صریحاً فعال شوند. برای تغییر ترتیب، آن‌ها را بکشید.",
        "asterisk: g726nonstandard. if the": "اگر همتا صدای G726-32 مذاکره کند، ترتیب بسته‌بندی AAL2 به‌جای RFC3551 استفاده می‌شود (برای برخی ATAها مانند Sipura و Grandstream لازم است). (asterisk: g726nonstandard)",
        "asterisk: t38pt_udptl. enables t38": "عبور فکس T.38 را فعال می‌کند تا کانال‌های SIP دارای کدک فکس T.38 بتوانند تماس را عبور دهند؛ خود آستریس رسانه را پردازش نمی‌کند. (asterisk: t38pt_udptl)",
        "check to enable and then": "فعال کنید و سپس کدک‌های مجاز را برگزینید. اگر کدک‌ها را یکی‌یکی و با ذخیرهٔ پس از هر انتخاب اضافه کنید، اولویت کدک‌ها به همان ترتیب ثبت می‌شود.",
        "maximum bitrate for video calls": "حداکثر نرخ بیت تماس‌های تصویری، بر حسب کیلوبیت بر ثانیه.",
        /* --- reinvite / RTP timers --- */
        "asterisk: canreinvite. yes: standard": "بازمسیری مستقیم رسانه: بله = دعوت‌های مجدد استاندارد؛ خیر = هرگز؛ nonat = فقط وقتی مقصد رسانه پشت NAT نیست؛ update = استفاده از UPDATE به‌جای INVITE. (asterisk: canreinvite)",
        "asterisk: rtptimeout. terminate call": "اگر تماس در حالت انتظار نباشد و به‌مدت rtptimeout ثانیه هیچ فعالیت RTP یا RTCP روی کانال صوتی نبود، تماس قطع می‌شود؛ اگر تماس در حالت انتظار باشد آستانه rtpholdtimeout اعمال می‌شود؛ بسته‌های keepalive با فاصلهٔ rtpkeepalive برای باز نگه‌داشتن NAT ارسال می‌شوند.",
        "asterisk: rtpstart. the starting": "بازهٔ پورت‌های RTP: rtpstart پورت شروع و rtpend پورت پایان است. (asterisk: rtpstart / rtpend)",
        /* --- MWI / BLF subscriptions --- */
        "frequency in seconds to check": "فاصلهٔ بررسی تغییر وضعیت نشانگر پیام جدید (MWI) و اطلاع‌رسانی به همتاها، بر حسب ثانیه.",
        "control whether subscriptions already": "تعیین می‌کند هنگام ورود تماس جدید، وضعیت «در حال زنگ‌خوردن» (RINGING) برای اشتراک‌هایی که «در حال استفاده» (INUSE) هستند نیز ارسال شود. برای BLF کاربرد دارد.",
        "control whether subscriptions inuse": "تعیین می‌کند هنگام انتظار تماس، وضعیت «در انتظار» (ONHOLD) به اشتراک‌ها اعلام شود. برای BLF کاربرد دارد.",
        /* --- registration --- */
        "asterisk: registertimeout. retry registration": "هر registertimeout ثانیه ثبت‌نام دوباره تلاش می‌شود تا سقف registrationattempts بار؛ مقدار ۰ یعنی تلاش بی‌نهایت (توصیه‌شده تا در قطعی شبکه ثبت‌نام ادامه یابد). (asterisk: registertimeout / registrationattempts)",
        "asterisk: minexpiry. minimum length": "کمینه (minexpiry)، بیشینه (maxexpiry) و مقدار پیش‌فرض (defaultexpiry) مدت ثبت‌نام‌ها بر حسب ثانیه.",
        /* --- jitterbuffer --- */
        "asterisk: jbenable. enables the use": "بافر جبران نوسان تأخیر (jitterbuffer) را در سمت دریافت کانال SIP فعال می‌کند؛ معمولاً فقط زمانی به کار می‌آید که سمت فرستنده نوسان ایجاد کند و گیرنده نتواند آن را بپذیرد.",
        "asterisk: jbforce. forces the use": "استفاده از بافر نوسان را در سمت دریافت اجباری می‌کند؛ معمولاً توصیه نمی‌شود چون تأخیر اضافه به جریان صدا می‌افگند. (asterisk: jbforce)",
        "asterisk: jbimpl. jitterbuffer implementation": "پیاده‌سازی بافر نوسان در سمت دریافت: fixed با اندازهٔ ثابت (برابر jbmaxsize) یا adaptive با اندازهٔ متغیر. (asterisk: jbimpl)",
        "asterisk: jblog. enables jitter": "ثبت فریم‌های بافر نوسان در لاگ را فعال می‌کند. (asterisk: jblog)",
        "asterisk: jbmaxsize. max length": "بیشینهٔ اندازهٔ بافر نوسان بر حسب میلی‌ثانیه؛ jbresyncthreshold جهش زمان‌فریم‌ها برای هم‌زمان‌سازی مجدد است و با -1 غیرفعال می‌شود. (asterisk: jbmaxsize / jbresyncthreshold)",
        /* --- language / misc --- */
        "default language for a channel": "زبان پیش‌فرض کانال. (Asterisk: language)",
        /* --- chan_sip legacy section --- */
        "asterisk: context. default context": "زمینهٔ (context) پیش‌فرض برای تماس‌های ورودی وقتی چیز دیگری مشخص نشده باشد. (asterisk: context)",
        "asterisk: bindaddr. the ip address": "آدرس IP که آستریس روی آن گوش می‌دهد؛ مقدار 0.0.0.0 یعنی همهٔ رابط‌های شبکه. (asterisk: bindaddr)",
        "asterisk: bindport. local incoming": "پورت UDP محلی که آستریس برای دریافت پیام‌های SIP روی آن گوش می‌دهد. (asterisk: bindport)",
        "asterisk: tls bindport. local": "پورت TLS محلی برای دریافت سیگنالینگ SIP رمزنگاری‌شده. (asterisk: tlsbindport)",
        "asterisk: allowguest. when set": "تماس‌های Guest در SIP پذیرفته و به context پیش‌فرض فرستاده می‌شوند؛ برای امنیت معمولاً باید خاموش بماند. (asterisk: allowguest)",
        "allowing inbound anonymous sip": "پذیرش تماس SIP ناشناس یعنی هر تماسی از فرستندهٔ ناشناس پذیرفته می‌شود؛ ریسک هرزتماس و امنیت دارد و فقط با آگاهی کامل فعال کنید.",
        "enable asterisk srvlookup": "جست‌وجوی رکورد SRV برای مقاصد تماس فعال می‌شود؛ محدودیت‌های نسخهٔ فعلی آستریس را ببینید. (asterisk: srvlookup)",
        "generate manager events when": "هنگام وقوع رخداد در تلفن SIP (مانند hold)، رخداد مدیر (manager event) تولید می‌شود.",
        "enable websocket connection handling": "مدیریت اتصال WebSocket را از طریق chan_sip فعال می‌کند؛ برای تلفن‌های WebRTC لازم است.",
        "you may set any other sip": "هر تنظیم دیگر SIP که در این صفحه نیست و در بخش General آستریس مجاز است را می‌توانید اینجا اضافه کنید.",
        /* --- generic PBX terms reused by other settings pages --- */
        "asterisk: language. default language": "زبان پیش‌فرض کانال. (Asterisk: language)",
        "context for the trunk": "زمینهٔ (context) ترانک در dialplan آستریس.",
        "the outbound caller id number": "شمارهٔ Caller ID ارسالی برای تماس‌های خروجی این ترانک.",
        "maximum number of simultaneous": "حداکثر تعداد تماس همزمان.",
        "number of seconds to ring": "مدت زنگ‌خوردن بر حسب ثانیه.",
        "allow listening to recorded": "اجازهٔ شنیدن ضبط‌ها."
    };

    var HELP_KEYS = Object.keys(HELP);

    function normHelp(s) {
        return String(s || "").replace(/[\u2066\u2069]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
    }

    /* translate every "?": only mutate the inner help span's text, never markup */
    function translateHelps(root) {
        if (!root.querySelectorAll) return;
        root.querySelectorAll("span.infohelp > span").forEach(function (sp) {
            if (sp.dataset.mtHelp === "1") return;
            var n = normHelp(sp.textContent);
            if (!n) return;
            /* English glyphs only — already-Persian spans never match keys */
            if (!/[a-z]/.test(n)) { sp.dataset.mtHelp = "1"; return; }
            var hit = null;
            for (var i = 0; i < HELP_KEYS.length; i++) {
                if (n.indexOf(HELP_KEYS[i]) === 0) {
                    if (hit) { hit = null; break; } /* ambiguous — keep English */
                    hit = HELP_KEYS[i];
                }
            }
            if (hit) {
                sp.setAttribute("dir", "rtl");
                sp.textContent = HELP[hit];
                sp.dataset.mtHelp = "1";
            }
        });
    }

    var sortedKeys = function (obj) {
        return Object.keys(obj).sort(function (a, b) { return b.length - a.length; });
    };

    /* idempotence: remember the exact text each node carried after our last
       pass — a node whose text did not change is never re-translated (no
       nested replacements, no bidi-marker growth on the 2.5s ticks) */
    var swapSeen = new WeakMap();

    function swapNode(node) {
        var txt = node.nodeValue;
        if (!txt || !txt.trim()) return;
        if (swapSeen.get(node) === txt) return;
        var orig = txt;
        var brandKeys = sortedKeys(BRAND);
        for (var i = 0; i < brandKeys.length; i++) {
            var k = brandKeys[i];
            if (txt.indexOf(k) !== -1) txt = txt.split(k).join(BRAND[k]);
        }
        /* full sentences beat word swaps (fixes "Add an Extension" → "افزودن an داخلی") */
        var flat = normHelp(txt);
        if (SENTENCES[flat]) {
            txt = SENTENCES[flat];
        } else {
            var faKeys = sortedKeys(FA);
            for (var j = 0; j < faKeys.length; j++) {
                var key = faKeys[j];
                if (txt.indexOf(key) === -1) continue;
                var esc = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                /* word boundaries only for pure-ASCII keys (protects Administrator etc.) */
                var pat = /^[A-Za-z0-9 _\-]+$/.test(key) ? new RegExp("\\b" + esc + "\\b", "g") : new RegExp(esc, "g");
                txt = txt.replace(pat, FA[key]);
            }
        }
        for (var p = 0; p < PATTERNS.length; p++) {
            txt = txt.replace(PATTERNS[p][0], PATTERNS[p][1]);
        }
        if (txt !== orig) node.nodeValue = bidiIsolate(txt);
        swapSeen.set(node, node.nodeValue);
    }

    /* wrap Latin runs in LRI..PDI so mixed Persian/English keeps logical order */
    function bidiIsolate(s) {
        if (!/[\u0600-\u06FF]/.test(s) || !/[A-Za-z]/.test(s)) return s;
        return s.replace(/([A-Za-z0-9][A-Za-z0-9 ()\u2192._\/:+-]{0,48}[A-Za-z0-9)٪%]|[A-Za-z0-9]+)/g, "\u2066$1\u2069");
    }

    /* technical inputs (IP/domain/number/secret) read better left-to-right.
       Token-aware so "description" never matches the "ip" alternative. */
    var LTR_TOKEN = /^(ip|host|hostname|fqdn|domain|uri|url|secret|pass|password|cid|callerid|clid|externip|externhost|externrefresh|bindaddr|bindport|tlsbindport|localnet|mask|port|ports|timeout|codec|dial|dialout|match|pattern|regex|context|language|lang|dtmf|bitrate|jbenable|jbforce|jbimpl|jbmaxsize|jbresyncthreshold|jblog|minexpiry|maxexpiry|defaultexpiry|registertimeout|registrationattempts|rtptimeout|rtpholdtimeout|rtpkeepalive|rtpstart|rtpend|canreinvite|g726nonstandard|t38pt_udptl|allowguest|srvlookup|nat_mode)$/;
    function markLtrInputs(root) {
        if (!root.querySelectorAll) return;
        root.querySelectorAll("input[type=text], input[type=password], input:not([type])").forEach(function (el) {
            if (el.dataset.mtLtr !== undefined) return;
            var n = ((el.name || "") + " " + (el.id || "")).toLowerCase();
            el.dataset.mtLtr = "1";
            var toks = n.split(/[^a-z0-9]+/);
            if (toks.some(function (t) { return LTR_TOKEN.test(t) || /^rtp/.test(t) || /^jb/.test(t) || /^extern/.test(t); })) {
                el.classList.add("mt-ltr");
            }
        });
    }

    function swap(root) {
        if (document.title) {
            var t = document.title;
            var bk = sortedKeys(BRAND);
            for (var i = 0; i < bk.length; i++) t = t.split(bk[i]).join(BRAND[bk[i]]);
            if (t !== document.title) document.title = t;
        }
        translateHelps(root);
        var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode: function (n) {
                var p = n.parentElement;
                if (!p) return NodeFilter.FILTER_REJECT;
                var tag = p.tagName;
                if (tag === "SCRIPT" || tag === "STYLE" || tag === "TEXTAREA" || tag === "INPUT") return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            }
        }, false);
        var node;
        while ((node = walker.nextNode())) swapNode(node);
        markLtrInputs(root);
        /* placeholders */
        root.querySelectorAll && root.querySelectorAll("[placeholder]").forEach(function (el) {
            var ph = el.getAttribute("placeholder");
            if (FA[ph]) el.setAttribute("placeholder", FA[ph]);
        });
    }

    function run() { swap(document.body); linkStack(); }

    /* pages whose whole body is a bare stack of <a><br><a> (trunks, some
       route/queue lists) become MyTel card lists */
    function linkStack() {
        var c = document.querySelector('.content');
        if (!c || c.dataset.mtStack === '1') return;
        if (c.querySelector('form, table')) return;
        var links = c.querySelectorAll(':scope > a');
        if (links.length < 3) return;
        c.dataset.mtStack = '1';
        c.querySelectorAll('br').forEach(function (b) { b.remove(); });
        c.classList.add('mt-linkstack');
        var first = c.querySelector(':scope > a');
        if (first && /^(add|new)/i.test(first.textContent || '')) first.classList.add('mt-linkstack-add');
    }

    document.addEventListener("DOMContentLoaded", run);
    window.addEventListener("load", function () { run(); setTimeout(run, 800); });
    /* late AJAX panels (module admin, freepbx ajax) */
    setInterval(run, 2500);

    /* helper tooltips for technical terms (title attribute only, no DOM changes) */
    var HELPERS = {
        "PJSIP": "نسخه جدیدتر رابط SIP در Asterisk برای مدیریت داخلی‌ها و ترانک‌ها",
        "RTP": "پروتکل انتقال صدای تماس",
        "RTCP": "پروتکل کنترل کیفیت جریان صدای تماس",
        "NAT": "تنظیمات عبور ترافیک تلفنی از شبکه‌های دارای آدرس خصوصی",
        "DTMF": "تن‌های دوگانه صفحه‌کلید تماس",
        "DID": "شماره مستقیم ورودی (Direct Inward Dialing)",
        "BLF": "چراغ وضعیت خطوط روی تلفن (Busy Lamp Field)",
        "MWI": "نشانگر پیام صوتی منتظر (Message Waiting Indicator)",
        "FQDN": "نام دامنهٔ کامل میزبان",
        "Caller ID": "شناسهٔ تماس‌گیرنده",
        "Jitterbuffer": "بافر جبران نوسان تأخیر صدا",
        "STUN": "کمک‌کار تشخیص آدرس عمومی پشت NAT",
        "TLS": "رمزنگاری انتقال سیگنالینگ SIP",
        "SRTP": "رمزنگاری جریان صدای تماس"
    };
    window.addEventListener("load", function () {
        setTimeout(function () {
            document.querySelectorAll("b, strong, label, td, th, dt, a").forEach(function (el) {
                var t = (el.textContent || "").trim();
                if (HELPERS[t] && !el.getAttribute("title")) el.setAttribute("title", HELPERS[t]);
            });
        }, 1200);
    });

    /* ---------- Apply Config overlay (presentation-only) ----------
       Shows a full-iframe feedback panel while retrieve_conf runs.
       Addresses GPT review: dismissible, role=status, reduced-motion,
       no silent removal, "waiting" not "running", covers iframe only. */
    (function applyOverlay() {
        var ov = null, t30 = null, t120 = null;

        function remove() {
            if (t30) clearTimeout(t30);
            if (t120) clearTimeout(t120);
            t30 = t120 = null;
            if (ov && ov.parentNode) ov.remove();
            ov = null;
        }

        function show() {
            if (document.getElementById("mt-apply-ov")) return;
            ov = document.createElement("div");
            ov.id = "mt-apply-ov";
            ov.setAttribute("role", "status");
            ov.setAttribute("aria-live", "polite");
            ov.style.cssText =
                "position:fixed;inset:0;z-index:9990;" +
                "background:rgba(8,15,28,.80);" +
                "display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;" +
                "font-family:Vazirmatn,Tahoma,sans-serif;";
            var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

            ov.innerHTML =
                '<style>@keyframes mtspin{to{transform:rotate(360deg)}}</style>' +
                '<div style="' + (reduce ? "" : "animation:mtspin 1s linear infinite;") +
                'width:44px;height:44px;border:4px solid rgba(255,138,0,.25);' +
                'border-top-color:#FF8A00;border-radius:50%"></div>' +
                '<div id="mt-ov-msg" style="color:#fff;font-size:18px;font-weight:700;' +
                'text-shadow:0 1px 3px rgba(0,0,0,.3)">در حال اعمال تغییرات مرکز تلفن…</div>' +
                '<div style="color:#AAB6CE;font-size:13px">این عملیات ممکن است تا یک دقیقه طول بکشد</div>' +
                '<button type="button" id="mt-ov-dismiss" style="' +
                'background:none;border:1px solid rgba(255,255,255,.3);color:#AAB6CE;' +
                'border-radius:6px;padding:5px 16px;font-size:12px;cursor:pointer;' +
                'font-family:inherit;margin-top:8px">بستن پیام</button>';

            document.body.appendChild(ov);

            ov.querySelector("#mt-ov-dismiss").addEventListener("click", remove);

            /* 30s: still waiting (not "running" — we can't know backend state) */
            t30 = setTimeout(function () {
                var m = document.getElementById("mt-ov-msg");
                if (m) m.textContent = "در انتظار پاسخ از سرور…";
            }, 30000);

            /* 120s: dismissible notice, not silent removal */
            t120 = setTimeout(function () {
                var m = document.getElementById("mt-ov-msg");
                if (m) {
                    m.textContent = "بیش از حد انتظار طول کشید";
                    m.style.color = "#FFB25C";
                }
                var sub = ov && ov.querySelector("div:nth-child(4)");
                if (sub) sub.textContent = "پردازش ممکن است همچنان در جریان باشد — می‌توانید پیام را ببندید";
            }, 120000);

            /* if page survives (AJAX path), hook swal/xhr completion to remove */
            var w = window;
            if (w.jQuery) {
                w.jQuery(document).one("ajaxComplete.mtOv", function (ev, xhr, opt) {
                    if (opt && /retrieve_conf|reload|apply/i.test(opt.url || "")) {
                        setTimeout(remove, 800);
                    }
                });
            }
        }

        document.addEventListener("click", function (ev) {
            var el = ev.target;
            if (!el || !el.closest) return;
            var btn = el.closest("#button_reload, a.button.is-danger");
            if (!btn) return;
            if (btn.disabled || btn.getAttribute("aria-disabled")) return;
            if (ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.altKey || ev.button !== 0) return;
            show();
        }, true);

        /* page restore (Back button) — clear any stale overlay state */
        window.addEventListener("pageshow", function (ev) {
            if (ev.persisted) remove();
        });
    })();

    /* ---------- admin console footer: append mytel.one link ---------- */
    window.addEventListener("load", function () {
        setTimeout(function () {
            var foot = document.querySelector("#footer, .footer, footer");
            if (!foot || document.getElementById("mt-footer-link")) return;
            var a = document.createElement("a");
            a.id = "mt-footer-link";
            a.href = "https://mytel.one";
            a.target = "_blank";
            a.rel = "noopener";
            a.textContent = " · mytel.one";
            a.style.cssText = "color:#FF8A00;text-decoration:none;font-weight:600";
            foot.appendChild(a);
        }, 2000);
    });
})();
