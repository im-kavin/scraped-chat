'use client';

import {
	AlertCircleIcon,
	FileArchiveIcon,
	FileIcon,
	FileSpreadsheetIcon,
	FileTextIcon,
	HeadphonesIcon,
	ImageIcon,
	Trash2Icon,
	UploadIcon,
	VideoIcon,
	XIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { formatBytes, useFileUpload } from '../../hooks/use-file-upload';
import { cn } from '../../lib/utils';
import type { FileWithPreview, OpenAIProcessedFile, UploadStatus } from '../../types';
import { Button } from './button';

const getFileIcon = (file: { file: File | { type: string; name: string } }) => {
	const fileType = file.file instanceof File ? file.file.type : file.file.type;
	const fileName = file.file instanceof File ? file.file.name : file.file.name;

	const commonIconClass = 'size-5 text-muted-foreground';

	const iconMap = {
		pdf: {
			icon: FileTextIcon,
			conditions: (type: string, name: string) =>
				type.includes('pdf') ||
				name.endsWith('.pdf') ||
				type.includes('word') ||
				name.endsWith('.doc') ||
				name.endsWith('.docx'),
		},
		archive: {
			icon: FileArchiveIcon,
			conditions: (type: string, name: string) =>
				type.includes('zip') ||
				type.includes('archive') ||
				name.endsWith('.zip') ||
				name.endsWith('.rar'),
		},
		excel: {
			icon: FileSpreadsheetIcon,
			conditions: (type: string, name: string) =>
				type.includes('excel') || name.endsWith('.xls') || name.endsWith('.xlsx'),
		},
		json: {
			icon: FileTextIcon,
			conditions: (type: string, name: string) => type.includes('json') || name.endsWith('.json'),
		},
		video: {
			icon: VideoIcon,
			conditions: (type: string) => type.includes('video/'),
		},
		audio: {
			icon: HeadphonesIcon,
			conditions: (type: string) => type.includes('audio/'),
		},
		image: {
			icon: ImageIcon,
			conditions: (type: string) => type.startsWith('image/'),
		},
	};

	for (const { icon: Icon, conditions } of Object.values(iconMap)) {
		if (conditions(fileType, fileName)) {
			return <Icon className={commonIconClass} />;
		}
	}

	return <FileIcon className={commonIconClass} />;
};

export default function UploadFiles() {
	const maxSizeMB = 5;
	const maxSize = maxSizeMB * 1024 * 1024;
	const maxFiles = 6;

	const [fileStatuses, setFileStatuses] = useState<UploadStatus[]>([]);
	const [openaiProcessedFiles, setOpenaiProcessedFiles] = useState<OpenAIProcessedFile[]>([]);
	const [isClearingOpenAIStorage, setIsClearingOpenAIStorage] = useState(false);
	const [clearOpenAIStorageMessage, setClearOpenAIStorageMessage] = useState<string | null>(null);

	useEffect(() => {
		const storedFiles = localStorage.getItem('openaiVectorizedFiles');
		if (storedFiles) {
			try {
				setOpenaiProcessedFiles(JSON.parse(storedFiles));
			} catch (_error) {
				localStorage.removeItem('openaiVectorizedFiles');
			}
		}
	}, []);

	const addOpenaiProcessedFileToStorage = (fileInfo: OpenAIProcessedFile) => {
		setOpenaiProcessedFiles((prevFiles) => {
			if (prevFiles.some((pf) => pf.fileId === fileInfo.fileId)) {
				return prevFiles;
			}
			const updatedFiles = [...prevFiles, fileInfo];
			localStorage.setItem('openaiVectorizedFiles', JSON.stringify(updatedFiles));
			window.dispatchEvent(
				new CustomEvent('knowledgeBaseUpdated', { detail: { newStore: fileInfo } }),
			);
			return updatedFiles;
		});
	};

	//biome-ignore lint/complexity/noExcessiveCognitiveComplexity: not needed for simple demo
	const handleFilesAdded = async (addedFiles: FileWithPreview[]) => {
		const newStatusItems: UploadStatus[] = addedFiles.map((file) => ({
			fileId: file.id,
			completed: false,
			status: 'queued',
		}));
		setFileStatuses((prev) => [...prev, ...newStatusItems]);

		for (const file of addedFiles) {
			if (file.file instanceof File) {
				const actualFileToUpload = file.file;
				setFileStatuses((prev) =>
					prev.map((item) =>
						item.fileId === file.id ? { ...item, status: 'uploading_to_server' } : item,
					),
				);

				try {
					const formData = new FormData();
					formData.append('file', actualFileToUpload);

					setFileStatuses((prev) =>
						prev.map((item) =>
							item.fileId === file.id ? { ...item, status: 'pending_openai' } : item,
						),
					);

					const response = await fetch('/api/chat', {
						method: 'PUT',
						body: formData,
					});

					const result = await response.json();

					if (!response.ok) {
						throw new Error(
							result.error ||
								`Upload failed for ${actualFileToUpload.name}. Status: ${response.status}`,
						);
					}

					addOpenaiProcessedFileToStorage({
						name: result.fileName,
						fileId: result.fileId,
						vectorStoreId: result.vectorStoreId,
					});

					setFileStatuses((prev) =>
						prev.map((item) =>
							item.fileId === file.id
								? { ...item, completed: true, status: 'completed_openai' }
								: item,
						),
					);
				} catch (error: unknown) {
					let errorMessage = 'Unknown error during OpenAI processing.';
					if (error instanceof Error) {
						errorMessage = error.message;
					}
					setFileStatuses((prev) =>
						prev.map((item) =>
							item.fileId === file.id
								? {
										...item,
										completed: false,
										status: 'failed',
										error: errorMessage,
									}
								: item,
						),
					);
				}
			} else {
				setFileStatuses((prev) =>
					prev.map((item) =>
						item.fileId === file.id
							? { ...item, completed: true, status: 'completed_openai' }
							: item,
					),
				);
			}
		}
	};

	const handleFileRemoved = (fileId: string) => {
		setFileStatuses((prev) => prev.filter((item) => item.fileId !== fileId));
	};

	const clearAllLocalAndUIFiles = () => {
		setFileStatuses([]);
		clearFiles();
	};

	const handleClearOpenAIStorage = async () => {
		const filesToProcess = [...openaiProcessedFiles];
		if (filesToProcess.length === 0) {
			setClearOpenAIStorageMessage('No files to clear from Knowledge Base.');
			setTimeout(() => setClearOpenAIStorageMessage(null), 3000);
			return;
		}

		setIsClearingOpenAIStorage(true);
		setClearOpenAIStorageMessage(
			`Attempting to clear ${filesToProcess.length} file(s) from Knowledge Base...`,
		);

		const deletionPromises = filesToProcess.map((file) =>
			fetch('/api/chat', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					fileId: file.fileId,
					vectorStoreId: file.vectorStoreId,
				}),
			})
				.then(async (response) => {
					const data = await response.json();
					if (!(response.ok && data.success)) {
						const errorMessage = data.error || `HTTP error ${response.status}`;
						return {
							fileId: file.fileId,
							success: false,
							error: errorMessage,
							fileName: file.name,
						};
					}
					return { fileId: file.fileId, success: true, fileName: file.name };
				})
				.catch((error) => {
					return {
						fileId: file.fileId,
						success: false,
						error: (error as Error).message,
						fileName: file.name,
					};
				}),
		);

		const results = await Promise.all(deletionPromises);

		setIsClearingOpenAIStorage(false);

		const successfullyDeletedFileIds = results.filter((r) => r.success).map((r) => r.fileId);
		const failedDeletions = results.filter((r) => !r.success);

		if (failedDeletions.length === 0) {
			localStorage.removeItem('openaiVectorizedFiles');
			setOpenaiProcessedFiles([]);
			setClearOpenAIStorageMessage(
				`All ${filesToProcess.length} files successfully cleared from Knowledge Base and local list.`,
			);
			window.dispatchEvent(
				new CustomEvent('knowledgeBaseUpdated', { detail: { allStoresCleared: true } }),
			);
		} else {
			const remainingFiles = filesToProcess.filter(
				(file) => !successfullyDeletedFileIds.includes(file.fileId),
			);
			localStorage.setItem('openaiVectorizedFiles', JSON.stringify(remainingFiles));
			setOpenaiProcessedFiles(remainingFiles);
			window.dispatchEvent(
				new CustomEvent('knowledgeBaseUpdated', { detail: { storesModified: true } }),
			);

			let errorMsg = `${failedDeletions.length} file(s) could not be cleared: `;
			errorMsg += failedDeletions.map((f) => `${f.fileName} (${f.error})`).join(', ');
			setClearOpenAIStorageMessage(`${errorMsg}. Local list updated.`);
		}

		setTimeout(() => setClearOpenAIStorageMessage(null), 7000);
	};

	const [
		{ files, isDragging, errors: hookErrors },
		{
			handleDragEnter,
			handleDragLeave,
			handleDragOver,
			handleDrop,
			openFileDialog,
			removeFile,
			clearFiles,
			getInputProps,
		},
	] = useFileUpload({
		multiple: true,
		maxFiles,
		maxSize,
		onFilesAdded: handleFilesAdded,
	});

	return (
		<div className="flex flex-col gap-6">
			{/* Drop area */}
			<div
				onDragEnter={handleDragEnter}
				onDragLeave={handleDragLeave}
				onDragOver={handleDragOver}
				onDrop={handleDrop}
				data-dragging={isDragging || undefined}
				className={cn(
					'relative flex flex-col items-center justify-center min-h-48 rounded-lg border-2 border-dashed border-border bg-muted/20 p-6 transition-colors',
					isDragging && 'border-primary bg-primary/10',
					files.length === 0 && 'py-12',
				)}
			>
				<input {...getInputProps()} className="sr-only" aria-label="Upload scraped data files" />
				{files.length > 0 ? (
					<div className="w-full space-y-3">
						<div className="flex items-center justify-between gap-2 mb-3 pb-3 border-b border-border">
							<h3 className="text-sm font-semibold text-foreground">
								Files to Upload ({files.length})
							</h3>
							<div className="flex gap-2">
								<Button variant="outline" size="sm" onClick={openFileDialog}>
									<UploadIcon className="mr-1.5" /> Add More
								</Button>
								<Button
									variant="ghost"
									size="sm"
									onClick={clearAllLocalAndUIFiles}
									className="text-muted-foreground hover:text-destructive"
								>
									<Trash2Icon className="mr-1.5" /> Clear Queued
								</Button>
							</div>
						</div>

						<div className="w-full space-y-2 max-h-60 overflow-y-auto pr-1">
							{/* biome-ignore lint/complexity/noExcessiveCognitiveComplexity: not needed for simple demo */}
							{files.map((file) => {
								const fileStatusInfo = fileStatuses.find((p) => p.fileId === file.id);
								const isProcessing =
									fileStatusInfo &&
									(fileStatusInfo.status === 'queued' ||
										fileStatusInfo.status === 'uploading_to_server' ||
										fileStatusInfo.status === 'pending_openai');

								return (
									<div
										key={file.id}
										className={cn(
											'flex flex-col gap-1.5 rounded-md border border-border bg-background p-2.5 transition-opacity duration-300',
											isProcessing && 'opacity-60',
										)}
									>
										<div className="flex items-center justify-between gap-2">
											<div className="flex items-center gap-2.5 overflow-hidden">
												<div className="flex aspect-square size-9 shrink-0 items-center justify-center rounded border border-border bg-muted/30">
													{getFileIcon(file)}
												</div>
												<div className="flex min-w-0 flex-col gap-0.5">
													<p className="truncate text-xs font-medium text-foreground">
														{file.file instanceof File ? file.file.name : file.file.name}
													</p>
													<p className="text-muted-foreground text-[11px]">
														{formatBytes(
															file.file instanceof File ? file.file.size : file.file.size,
														)}
													</p>
												</div>
											</div>
											<Button
												size="icon"
												variant="ghost"
												className="text-muted-foreground hover:text-destructive size-7 rounded-md"
												onClick={() => {
													handleFileRemoved(file.id);
													removeFile(file.id);
												}}
												aria-label="Remove file from queue"
											>
												<XIcon size={14} />
											</Button>
										</div>

										{fileStatusInfo && (
											<div className="mt-1 text-[11px]">
												{fileStatusInfo.status === 'queued' && (
													<p className="text-muted-foreground">Queued for processing...</p>
												)}
												{fileStatusInfo.status === 'uploading_to_server' && (
													<p className="text-blue-600 dark:text-blue-400">Uploading data...</p>
												)}
												{fileStatusInfo.status === 'pending_openai' && (
													<p className="text-blue-600 dark:text-blue-400">
														Adding to Knowledge Base...
													</p>
												)}
												{fileStatusInfo.status === 'completed_openai' && (
													<p className="text-green-600 dark:text-green-500">
														Added to Knowledge Base.
													</p>
												)}
												{fileStatusInfo.status === 'failed' && (
													<p className="text-destructive">
														Failed: {fileStatusInfo.error || 'Unknown error'}
													</p>
												)}
											</div>
										)}
									</div>
								);
							})}
						</div>
					</div>
				) : (
					<div className="flex flex-col items-center justify-center text-center">
						<div
							className="mb-3 flex size-12 shrink-0 items-center justify-center rounded-full border border-border bg-background"
							aria-hidden="true"
						>
							<UploadIcon className="size-6 text-muted-foreground" />
						</div>
						<p className="mb-1 text-sm font-medium text-foreground">
							Drop your files here or click to browse
						</p>
						<p className="text-xs text-muted-foreground">
							Max {maxFiles} files, up to {maxSizeMB}MB each.
						</p>
						<Button variant="link" size="sm" className="mt-3 text-sm" onClick={openFileDialog}>
							Browse Files
						</Button>
					</div>
				)}
			</div>

			{hookErrors.length > 0 && (
				<div className="text-sm text-destructive flex items-center gap-1.5" role="alert">
					<AlertCircleIcon className="size-4 shrink-0" />
					<span>{hookErrors[0]}</span>
				</div>
			)}

			{/* Current Knowledge Base Files Section */}
			<div className="mt-4">
				<h4 className="text-sm mb-2 font-semibold text-foreground">
					Current Scraped Data ({openaiProcessedFiles.length})
				</h4>
				{openaiProcessedFiles.length === 0 ? (
					<p className="text-xs text-muted-foreground p-3 bg-muted/30 rounded-md border border-border">
						No data has been added to the AI's knowledge base yet. Upload files above.
					</p>
				) : (
					<div className="max-h-40 overflow-y-auto space-y-1.5 rounded-md border border-border bg-muted/20 p-2">
						{openaiProcessedFiles.map((vectorFile) => (
							<div
								key={vectorFile.fileId}
								className="text-xs p-2 bg-background rounded shadow-sm border border-border flex justify-between items-center"
							>
								<span
									className="truncate text-foreground"
									title={`${vectorFile.name} (File ID: ${vectorFile.fileId}, Store ID: ${vectorFile.vectorStoreId})`}
								>
									{vectorFile.name}
								</span>
								{/* Add a delete button per file here if needed in the future */}
							</div>
						))}
					</div>
				)}
				{openaiProcessedFiles.length > 0 && (
					<Button
						variant="destructive"
						size="sm"
						className="mt-3 w-full"
						onClick={handleClearOpenAIStorage}
						disabled={isClearingOpenAIStorage || openaiProcessedFiles.length === 0}
					>
						<Trash2Icon className="mr-1.5 size-3.5" />
						{isClearingOpenAIStorage
							? 'Clearing Knowledge Base...'
							: 'Clear All from Knowledge Base'}
					</Button>
				)}
				{clearOpenAIStorageMessage && (
					<p
						className={cn(
							'text-xs mt-2 text-center',
							clearOpenAIStorageMessage.includes('successfully cleared') ||
								clearOpenAIStorageMessage.includes('All')
								? 'text-green-600 dark:text-green-500'
								: clearOpenAIStorageMessage.includes('No files to clear')
									? 'text-muted-foreground'
									: 'text-destructive',
						)}
					>
						{clearOpenAIStorageMessage}
					</p>
				)}
			</div>

			<p className="text-xs text-muted-foreground mt-1">
				Uploaded files are added to a persistent Knowledge Base for the AI to reference.
			</p>
		</div>
	);
}
