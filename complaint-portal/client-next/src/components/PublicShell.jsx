"use client";

import Link from "next/link";
import LanguageSwitcher from "./LanguageSwitcher.jsx";
import { t } from "../i18n/index.js";

const APTHEX_MARK = (
  <path
    fill="currentColor"
    d="M1030.9 1034.8C1015.3 1011.8 986.9 970.4 979.2 959.5C974.5 952.9 960.1 932.4 947.2 914.0C905.1 854.0 835.4 756.3 776.6 675.0C759.9 651.8 756.1 646.6 733.9 616.0C721.7 599.2 708.6 581.2 704.9 576.0C701.1 570.8 697.0 565.3 695.8 563.7L693.5 561.0L680.9 572.2C654.5 595.8 554.0 687.0 500.0 736.4C417.3 812.1 340.7 884.2 234.6 986.2C215.9 1004.2 200.4 1018.7 200.2 1018.6C199.6 1017.9 270.6 921.3 300.5 882.0C384.0 772.4 543.2 571.3 627.9 468.5C649.0 442.9 699.4 382.2 725.6 351.0C788.5 276.0 881.3 170.6 879.7 176.0C879.5 176.8 873.2 196.2 865.7 219.0C858.3 241.8 846.7 277.4 840.0 298.0C833.3 318.6 821.2 355.8 813.0 380.5C804.8 405.2 794.0 438.0 789.1 453.2L780.1 480.9L785.2 491.2C791.4 503.9 812.7 548.2 818.7 561.0C823.3 570.6 825.3 575.1 870.0 670.5C883.9 700.2 899.0 732.6 903.5 742.5C908.0 752.4 915.7 769.0 920.5 779.5C946.0 834.9 995.7 946.0 1018.5 998.5C1024.9 1013.4 1032.0 1029.5 1034.1 1034.4C1036.2 1039.3 1037.8 1043.5 1037.6 1043.7C1037.4 1043.9 1034.4 1039.9 1030.9 1034.8ZM850.0 913.4C804.4 892.3 764.7 875.8 703.6 852.4C691.4 847.7 679.5 843.1 677.0 842.0C674.5 841.0 664.1 837.0 653.8 833.1L635.2 826.1L610.3 834.1C531.9 859.4 416.1 899.1 381.8 912.5C377.1 914.3 381.6 909.7 399.2 894.2C441.1 857.7 515.8 793.9 557.2 759.4L589.9 732.1L638.2 732.7L686.6 733.3L692.2 719.9C695.3 712.5 699.3 702.8 701.1 698.2C702.9 693.7 704.6 690.0 704.9 690.0C705.2 690.0 708.3 694.0 711.7 698.8C715.1 703.6 723.0 714.5 729.2 723.1C742.6 741.6 771.1 781.2 786.5 802.5C792.5 811.0 807.0 831.0 818.6 847.2C854.5 896.9 872.0 921.5 872.0 922.2C872.0 923.5 871.2 923.2 850.0 913.4Z"
  />
);

export default function PublicShell({ children, lang, setLang, hideNav = false }) {
  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <div className="emergency-strip">
        <span>
          <span>{t(lang, "footerEmergency")}</span>
          <span className="emergency-strip-help">
            <a href="tel:+919421161446">94211 61446</a>
            <span aria-hidden="true">·</span>
            <a href="mailto:help@apthex.com">help@apthex.com</a>
          </span>
        </span>
      </div>
      <header className="public-header">
        <div className="public-header-inner">
          <Link href="/" className="brand" aria-label="APTHEX Complaint Portal home">
            <svg className="brand-mark-svg" viewBox="192 167 853 884" aria-hidden="true">{APTHEX_MARK}</svg>
            <span className="brand-mark">APTHEX</span>
            <span className="brand-sub">Complaint Portal</span>
          </Link>
          {!hideNav && (
            <nav className="public-nav" aria-label="Main navigation">
              <Link href="/status">{t(lang, "navStatus")}</Link>
            </nav>
          )}
          <LanguageSwitcher lang={lang} setLang={setLang} compact />
        </div>
      </header>
      <main id="main-content">{children}</main>
      <footer className="public-footer">
        <div className="footer-inner">
          <div>
            <div className="footer-brand">APTHEX</div>
            <p>{t(lang, "footerNote")}</p>
          </div>
          <div className="footer-links">
            <Link href="/status">{t(lang, "navStatus")}</Link>
          </div>
          <div className="footer-privacy">
            <span>{t(lang, "footerPrivacy")}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
