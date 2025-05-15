import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import type * as React from 'react';
import './globals.css';

const geistSans = Geist({
	variable: '--font-geist-sans',
	subsets: ['latin'],
});

const geistMono = Geist_Mono({
	variable: '--font-geist-mono',
	subsets: ['latin'],
});

export const metadata: Metadata = {
	title: 'Scraped Chat Demo',
	description:
		'A Next.js application demonstrating how to use OpenAI Vector Stores to chat with your own scraped data.',
	icons: {
		icon: 'https://platform.openai.com/favicon-platform.svg',
	},
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body>
		</html>
	);
}
