// import { Component, ReactNode } from 'react'

// export default class ErrorBoundary extends Component
//   { children: ReactNode },
//   { error: Error | null }
// > {
//   state = { error: null }

//   static getDerivedStateFromError(error: Error) {
//     return { error }
//   }

//   render() {
//     if (this.state.error) {
//       return (
//         <div className="min-h-screen flex items-center justify-center p-8 text-center">
//           <div className="space-y-3">
//             <p className="text-2xl">😵</p>
//             <p className="font-medium text-gray-800">Something went wrong</p>
//             <p className="text-sm text-gray-500">
//               {(this.state.error as Error).message}
//             </p>
//             <button
//               onClick={() => window.location.reload()}
//               className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm"
//             >
//               Reload
//             </button>
//           </div>
//         </div>
//       )
//     }
//     return this.props.children
//   }
// }