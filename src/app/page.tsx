'use client';

import { UploadCloud } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../components/ui/button';
import ChatInput from '../components/ui/chat-input';
import ChatMessage from '../components/ui/chat-message';
import ConfigPanel from '../components/ui/config-panel';
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '../components/ui/dialog';
import LoadingSpinner from '../components/ui/loading-spinner';
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from '../components/ui/sheet';
import UploadFiles from '../components/ui/upload-files';
import type { ChatRequest, Message, OpenAIProcessedFile, StoreDetail } from '../types';

export default function Home() {
	const [messages, setMessages] = useState<Message[]>([]);
	const [loading, setLoading] = useState(false);
	const [configOpen, setConfigOpen] = useState(false);
	const [selectedVectorStoreId, setSelectedVectorStoreId] = useState<string | null>(null);
	const [allKnowledgeBases, setAllKnowledgeBases] = useState<OpenAIProcessedFile[]>([]);
	const [previousResponseId, setPreviousResponseId] = useState<string | null>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const [uploadFromEmptyStateDialogOpen, setUploadFromEmptyStateDialogOpen] = useState(false);

	const loadStores = useCallback(() => {
		const storedFiles = localStorage.getItem('openaiVectorizedFiles');
		if (storedFiles) {
			try {
				setAllKnowledgeBases(JSON.parse(storedFiles));
			} catch (_e) {
				localStorage.removeItem('openaiVectorizedFiles');
				setAllKnowledgeBases([]);
			}
		} else {
			setAllKnowledgeBases([]);
		}
	}, []);

	const scrollToBottom = useCallback(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, []);

	useEffect(() => {
		if (messages.length > 0) {
			scrollToBottom();
		}
	}, [messages, scrollToBottom]);

	// Load knowledge bases from localStorage on initial mount
	useEffect(() => {
		loadStores();
	}, [loadStores]);

	useEffect(() => {
		const handleKnowledgeBaseUpdate = (event: Event) => {
			const customEvent = event as CustomEvent;
			//biome-ignore lint/complexity/noExcessiveCognitiveComplexity: not necessary for demo
			setTimeout(() => {
				loadStores(); // Always refresh the list of stores
				if (customEvent.detail?.newStore?.vectorStoreId) {
					setSelectedVectorStoreId(customEvent.detail.newStore.vectorStoreId);
				} else if (customEvent.detail?.allStoresCleared) {
					setSelectedVectorStoreId(null);
				} else if (customEvent.detail?.storesModified) {
					// If stores were modified (e.g. partial deletion) and the currently selected store no longer exists,
					// deselect it. This requires checking against the updated list from loadStores.
					const storedFiles = localStorage.getItem('openaiVectorizedFiles');
					let currentStores: OpenAIProcessedFile[] = [];
					if (storedFiles) {
						try {
							currentStores = JSON.parse(storedFiles);
						} catch {
							/* ignore */
						}
					}
					if (
						selectedVectorStoreId &&
						!currentStores.some((s) => s.vectorStoreId === selectedVectorStoreId)
					) {
						setSelectedVectorStoreId(null);
					}
				}
			}, 0);
		};

		window.addEventListener('knowledgeBaseUpdated', handleKnowledgeBaseUpdate);
		return () => {
			window.removeEventListener('knowledgeBaseUpdated', handleKnowledgeBaseUpdate);
		};
	}, [loadStores, selectedVectorStoreId]); // Added selectedVectorStoreId to dependencies

	//biome-ignore lint/complexity/noExcessiveCognitiveComplexity: not necessary for demo
	const handleSendMessage = async (messageContent: string) => {
		const userMessage: Message = {
			role: 'user',
			content: messageContent,
			id: crypto.randomUUID(),
		};

		setMessages((prev) => [...prev, userMessage]);
		setLoading(true);

		let errorMessage = "Sorry, I couldn't process your request. Please try again.";

		try {
			const requestBody: ChatRequest = {
				messages: [...messages, userMessage],
				vectorStoreId: selectedVectorStoreId,
			};
			if (previousResponseId) {
				requestBody.previousResponseId = previousResponseId;
			}

			const response = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(requestBody),
			});

			if (!response.ok) {
				try {
					const errorData = await response.json();
					errorMessage = errorData?.error || `Network error: ${response.status}`;
				} catch (_e) {
					errorMessage = `Network error: ${response.status} ${response.statusText}`;
				}
				throw new Error(errorMessage);
			}

			const data = await response.json();
			const botMessage: Message = {
				role: 'assistant',
				content: data.response,
				id: data.responseId || crypto.randomUUID(),
			};
			setMessages((prev) => [...prev, botMessage]);
			if (data.responseId) {
				setPreviousResponseId(data.responseId);
			} else {
				setPreviousResponseId(null);
			}
		} catch (error: unknown) {
			if (error instanceof Error) {
				errorMessage = error.message;
			}
			setMessages((prev) => [
				...prev,
				{ role: 'assistant', content: errorMessage, id: crypto.randomUUID() },
			]);
			setPreviousResponseId(null);
		} finally {
			setLoading(false);
		}
	};

	const toggleConfig = () => {
		const newConfigOpenState = !configOpen;
		setConfigOpen(newConfigOpenState);
		// If the panel is being closed (i.e., it was open and now it's not)
		if (configOpen && !newConfigOpenState) {
			loadStores();
		}
	};

	// Prepare the props for ChatInput
	const chatInputAvailableStores: StoreDetail[] = allKnowledgeBases.map((kb) => ({
		id: kb.vectorStoreId,
		name: kb.name,
		isActive: kb.vectorStoreId === selectedVectorStoreId,
	}));

	const handleChatInputChangeStoreToggle = (storeId: string) => {
		setSelectedVectorStoreId((prevId) => (prevId === storeId ? null : storeId));
	};

	return (
		<div className="h-screen flex flex-col overflow-hidden bg-background text-foreground">
			<Dialog
				open={uploadFromEmptyStateDialogOpen}
				onOpenChange={setUploadFromEmptyStateDialogOpen}
			>
				<div className="flex-1 flex flex-col overflow-y-auto">
					{/* Chat messages area */}
					<div className="flex-1 p-4 sm:p-6 md:p-8 space-y-4">
						{messages.length === 0 && !loading ? (
							<div className="h-full flex flex-col items-center justify-center text-center p-4">
								<DialogTrigger asChild={true}>
									<button
										type="button"
										className="group flex flex-col items-center justify-center border border-brand-blue rounded-lg p-8 cursor-pointer transition-colors w-full max-w-md hover:bg-brand-blue/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2 focus-visible:ring-offset-background"
									>
										<div className="p-4 mb-4 rounded-full transition-colors">
											<UploadCloud size={32} className="text-brand-blue" />
										</div>
										<h3 className="text-lg font-semibold text-foreground mb-2">
											Add Scraped Data for AI Context
										</h3>
										<p className="text-muted-foreground max-w-sm text-sm">
											The scraped data will be processed, vectorized, and stored in an OpenAI vector
											store for the assistant to reference, enabling more informed and contextual
											responses.
										</p>
									</button>
								</DialogTrigger>
							</div>
						) : (
							messages.map((message) => <ChatMessage key={message.id} message={message} />)
						)}
						{loading && <LoadingSpinner />}
						<div ref={messagesEndRef} />
					</div>

					{/* Chat input is part of this column now, so it gets pushed up by keyboard */}
					<ChatInput
						onSend={handleSendMessage}
						disabled={loading}
						onOpenSettings={toggleConfig}
						availableStores={chatInputAvailableStores}
						onStoreToggle={handleChatInputChangeStoreToggle}
					/>
				</div>

				{/* Dialog for uploading files from empty state */}
				<DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-0">
					<DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
						<DialogTitle>Upload & Manage Files</DialogTitle>
						<DialogDescription>
							Upload files to provide context to the AI. These files will be processed and stored
							for reference.
						</DialogDescription>
					</DialogHeader>
					<div className="flex-grow overflow-y-auto p-6">
						<UploadFiles />
					</div>
					<DialogFooter className="px-6 py-4 border-t border-border sm:justify-end">
						<DialogClose asChild={true}>
							<Button type="button" variant="outline">
								Close
							</Button>
						</DialogClose>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Config panel as a Sheet */}
			<Sheet open={configOpen} onOpenChange={setConfigOpen}>
				<SheetContent side="right" className="w-full md:w-96 p-0 flex flex-col">
					<SheetHeader className="px-4 py-3 border-b border-border">
						<SheetTitle>Configuration</SheetTitle>
						<SheetDescription>
							Manage your application settings and preferences, including knowledge base selection.
						</SheetDescription>
					</SheetHeader>
					<div className="flex-1 overflow-y-auto">
						<ConfigPanel
							selectedVectorStoreId={selectedVectorStoreId}
							onSelectedVectorStoreChange={setSelectedVectorStoreId}
						/>
					</div>
				</SheetContent>
			</Sheet>
		</div>
	);
}
