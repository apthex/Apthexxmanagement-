import "./globals.css";

export const metadata = {
  title: {
    default: "APTHEX Complaint Portal",
    template: "%s · APTHEX Complaint Portal",
  },
  description:
    "Private, public complaint reporting for schools and colleges. Report cyberbullying, blackmail, fraud or institutional safety concerns to APTHEX without creating an account.",
  applicationName: "APTHEX Complaint Portal",
  robots: { index: true, follow: true },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#050609",
  colorScheme: "dark",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
