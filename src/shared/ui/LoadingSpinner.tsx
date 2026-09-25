export default function LoadingSpinner() {
	return (
		<div className="fixed inset-0 flex items-center justify-center bg-white z-50">
			<div className="h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
		</div>
	);
}
