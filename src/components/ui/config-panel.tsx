import { UploadCloud, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '../../lib/utils';
import type { ConfigPanelProps, OpenAIProcessedFile } from '../../types';
import { Button } from './button';
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from './dialog';
import UploadFiles from './upload-files';

export default function ConfigPanel({
	selectedVectorStoreId,
	onSelectedVectorStoreChange,
}: ConfigPanelProps) {
	const [showUploadDialog, setShowUploadDialog] = useState(false);
	const [availableStores, setAvailableStores] = useState<OpenAIProcessedFile[]>([]);

	useEffect(() => {
		const loadStoresFromLocalStorage = () => {
			const storedFiles = localStorage.getItem('openaiVectorizedFiles');
			if (storedFiles) {
				try {
					setAvailableStores(JSON.parse(storedFiles));
				} catch (_e) {
					localStorage.removeItem('openaiVectorizedFiles');
					setAvailableStores([]);
				}
			} else {
				setAvailableStores([]);
			}
		};
		loadStoresFromLocalStorage();

		if (!showUploadDialog) {
			// Reload stores if dialog was closed (potentially after an upload)
			loadStoresFromLocalStorage();
		}

		const handleKnowledgeBaseUpdateEvent = (event: Event) => {
			const customEvent = event as CustomEvent;
			//biome-ignore lint/complexity/noExcessiveCognitiveComplexity: not necessary for demo
			setTimeout(() => {
				loadStoresFromLocalStorage(); // Always refresh the list
				if (customEvent.detail?.newStore?.vectorStoreId) {
					onSelectedVectorStoreChange(customEvent.detail.newStore.vectorStoreId);
				} else if (customEvent.detail?.allStoresCleared) {
					onSelectedVectorStoreChange(null);
				} else if (customEvent.detail?.storesModified) {
					// Check if the currently selected store in parent (passed as selectedVectorStoreId prop)
					// still exists in the updated list from localStorage.
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
						onSelectedVectorStoreChange(null); // If parent selection is now invalid, clear it
					}
				}
			}, 0);
		};

		window.addEventListener('knowledgeBaseUpdated', handleKnowledgeBaseUpdateEvent);

		return () => {
			window.removeEventListener('knowledgeBaseUpdated', handleKnowledgeBaseUpdateEvent);
		};
	}, [showUploadDialog, onSelectedVectorStoreChange, selectedVectorStoreId]);

	const handleSelectStore = (storeId: string) => {
		if (selectedVectorStoreId === storeId) {
			onSelectedVectorStoreChange(null);
		} else {
			onSelectedVectorStoreChange(storeId);
		}
	};

	return (
		<div className="h-full p-4 bg-card text-card-foreground flex flex-col gap-6">
			{/* Vector Store & Uploads Panel */}
			<Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
				<div className="bg-background rounded-lg border border-border p-4">
					<div className="flex items-center justify-between mb-3">
						<div className="flex items-center">
							<UploadCloud size={18} className="text-brand-blue mr-2" />
							<span className="text-sm font-semibold text-foreground">Scraped Data</span>
						</div>
						<DialogTrigger asChild={true}>
							<Button variant="outline" size="sm">
								Manage Scraped Sources
							</Button>
						</DialogTrigger>
					</div>

					<p className="text-sm text-muted-foreground mb-4">
						Select a knowledge base to reference in the chat, or upload new files.
					</p>

					{availableStores.length > 0 ? (
						<>
							<label
								htmlFor="vectorStoreSelect"
								className="block text-xs font-medium text-muted-foreground mb-1.5"
							>
								Available for chat:
							</label>
							<div className="space-y-2 max-h-48 overflow-y-auto py-1 rounded-md bg-muted/30">
								{availableStores.map((store) => (
									<button
										key={store.vectorStoreId}
										type="button"
										onClick={() => handleSelectStore(store.vectorStoreId)}
										title={`File: ${store.name}\nFile ID: ${store.fileId}\nStore ID: ${store.vectorStoreId}`}
										className={cn(
											'w-full text-left p-2.5 rounded-md border-2 transition-all text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
											selectedVectorStoreId === store.vectorStoreId
												? 'border-brand-blue text-brand-blue bg-transparent hover:bg-brand-blue/10 focus-visible:ring-brand-blue'
												: 'bg-background border-border text-foreground hover:bg-accent hover:border-input',
										)}
									>
										{store.name}
									</button>
								))}
							</div>
							{selectedVectorStoreId && (
								<Button
									variant="link"
									size="sm"
									onClick={() => onSelectedVectorStoreChange(null)}
									className="mt-2.5 text-destructive hover:text-destructive/80 px-0 h-auto flex items-center"
								>
									<X size={14} className="mr-1" />
									Clear Selection
								</Button>
							)}
						</>
					) : (
						<div className="text-center py-5 px-3 bg-muted/30 rounded-md border border-dashed border-border">
							<UploadCloud size={28} className="text-muted-foreground mx-auto mb-2.5" />
							<p className="text-sm text-foreground mb-1 font-medium">No knowledge bases found.</p>
							<p className="text-xs text-muted-foreground mb-3">Upload files to create one.</p>
							<DialogTrigger asChild={true}>
								<Button variant="link" size="sm" className="text-sm">
									Upload Files Now
								</Button>
							</DialogTrigger>
						</div>
					)}
				</div>

				<DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-0">
					<DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
						<DialogTitle>Upload & Manage Files</DialogTitle>
						<DialogDescription>
							Upload new files or manage existing ones for your knowledge base.
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
		</div>
	);
}
