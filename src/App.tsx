import { Route, Routes } from 'react-router-dom'
import Navbar from './components/Navbar'
import Gallery from './pages/Gallery'
import Home from './pages/Home'
import Patterns from './pages/Patterns'
import Studio from './pages/Studio'
import TryOn from './pages/TryOn'

function App() {
  return (
    <div className="flex min-h-svh flex-col">
      <Navbar />
      <main className="flex flex-1 flex-col pt-14">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/studio" element={<Studio />} />
          <Route path="/tryon" element={<TryOn />} />
          <Route path="/patterns" element={<Patterns />} />
          <Route path="/gallery" element={<Gallery />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
