// Loading animation component
export default function LoadingSpinner() {
	return (
		<div className="flex justify-center my-6">
			<div className="flex space-x-1.5">
				<div
					className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce"
					style={{ animationDelay: '0ms' }}
				/>
				<div
					className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce"
					style={{ animationDelay: '150ms' }}
				/>
				<div
					className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce"
					style={{ animationDelay: '300ms' }}
				/>
			</div>
		</div>
	);
}
