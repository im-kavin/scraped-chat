import { Bot, User } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { ChatMessageProps } from '../../types';

// interface ChatMessageProps {
// 	message: Message;
// }

export default function ChatMessage({ message }: ChatMessageProps) {
	const isUser = message.role === 'user';

	const avatarClasses =
		'flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold';
	const userAvatarClasses = 'bg-primary text-primary-foreground';
	const botAvatarClasses = 'bg-muted text-muted-foreground';

	const bubbleClasses =
		'relative max-w-xl px-3.5 py-2 rounded-xl shadow-sm text-sm whitespace-pre-wrap break-words'; // Slightly reduced padding
	const userBubbleClasses = 'bg-primary text-primary-foreground rounded-br-none';
	const botBubbleClasses = 'bg-card text-card-foreground border border-border rounded-bl-none';

	return (
		<div
			className={cn(
				'flex items-start gap-2.5 mb-4', // Adjusted gap and mb
				isUser ? 'flex-row-reverse' : 'flex-row',
			)}
		>
			<div className={cn(avatarClasses, isUser ? userAvatarClasses : botAvatarClasses)}>
				{isUser ? <User size={16} /> : <Bot size={16} />}
			</div>

			<div className={cn(bubbleClasses, isUser ? userBubbleClasses : botBubbleClasses)}>
				<p>{message.content}</p> {/* No specific class needed if bubble handles text style */}
			</div>
		</div>
	);
}
