'use client';

import { Send, Settings, X } from 'lucide-react';
import type * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/utils';

interface StoreDetail {
	id: string;
	name: string;
	isActive: boolean;
}

interface ChatInputProps {
	onSend: (message: string) => void;
	onOpenSettings: () => void;
	disabled: boolean;
	availableStores?: StoreDetail[];
	onStoreToggle?: (storeId: string) => void;
}

// Consistent styling for action buttons (Settings, Send)
const actionButtonClasses =
	'p-2 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

export default function ChatInput({
	onSend,
	onOpenSettings,
	disabled,
	availableStores,
	onStoreToggle,
}: ChatInputProps) {
	const [message, setMessage] = useState('');
	const [isFocused, setIsFocused] = useState(false);
	const inputRef = useRef<HTMLTextAreaElement>(null);

	const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		setMessage(e.target.value);
	};

	const handleSend = () => {
		if (message.trim()) {
			onSend(message.trim());
			setMessage('');
		}
	};

	const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	};

	const handleFocus = () => setIsFocused(true);
	const handleBlur = () => setIsFocused(false);
	const handleClear = () => {
		setMessage('');
		inputRef.current?.focus();
	};

	useEffect(() => {
		inputRef.current?.focus();
	}, []);

	const showStoresSection = availableStores && availableStores.length > 0 && onStoreToggle;

	return (
		<div className="max-w-4xl mx-auto w-full px-4 mb-3">
			<div
				className={cn(
					'flex flex-col border border-input bg-card shadow-sm transition-shadow',
					isFocused && 'ring-1 ring-ring shadow-md',
					showStoresSection ? 'rounded-t-lg' : 'rounded-lg',
				)}
			>
				<div className="flex items-center p-2.5">
					{' '}
					{/* Adjusted padding slightly */}
					<div className="relative flex-1">
						<textarea
							ref={inputRef}
							id="chat-message-input"
							name="chat-message-input"
							className="w-full pl-2 pr-8 py-1.5 bg-transparent border-none focus:outline-none text-foreground placeholder:text-muted-foreground resize-none min-h-[2.5rem] max-h-[8rem] align-middle"
							placeholder="Type a message..."
							value={message}
							onChange={handleChange}
							onKeyDown={handleKeyPress}
							onFocus={handleFocus}
							onBlur={handleBlur}
							disabled={disabled}
							rows={1}
						/>
						{message && (
							<button
								type="button"
								className={cn(
									actionButtonClasses,
									'absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground hover:bg-accent',
								)}
								onClick={handleClear}
								aria-label="Clear input"
							>
								<X size={16} />
							</button>
						)}
					</div>
					<div className="flex items-center gap-1 ml-1.5">
						{' '}
						{/* Adjusted spacing */}
						<button
							type="button"
							className={cn(
								actionButtonClasses,
								'text-muted-foreground hover:text-primary hover:bg-accent',
							)}
							onClick={onOpenSettings}
							aria-label="Open settings"
						>
							<Settings size={20} />
						</button>
						<button
							type="button"
							className={cn(
								actionButtonClasses,
								message.trim()
									? 'bg-primary text-primary-foreground hover:bg-primary/90'
									: 'bg-muted text-muted-foreground cursor-not-allowed',
							)}
							onClick={handleSend}
							disabled={!message.trim() || disabled}
							aria-label="Send message"
						>
							<Send size={20} />
						</button>
					</div>
				</div>

				{showStoresSection && (
					<div className="border-t border-input px-3 py-2.5 bg-card rounded-b-lg">
						{' '}
						{/* Adjusted padding */}
						<p className="text-xs text-muted-foreground mb-2">Referencing:</p>
						<div className="flex flex-wrap gap-1.5">
							{' '}
							{/* Adjusted gap */}
							{availableStores.map((store) => (
								<button
									key={store.id}
									type="button"
									onClick={() => onStoreToggle(store.id)}
									className={cn(
										'px-2.5 py-1 text-xs font-medium rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
										store.isActive
											? 'border-brand-blue text-brand-blue bg-transparent hover:bg-brand-blue/10 focus-visible:ring-brand-blue'
											: 'border-border text-muted-foreground bg-accent/50 hover:bg-accent hover:text-foreground',
									)}
									title={
										store.isActive ? `Stop referencing ${store.name}` : `Reference ${store.name}`
									}
								>
									{store.name}
								</button>
							))}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
