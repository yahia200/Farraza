function Hero() {
    return (
        <section className='w-full flex flex-col bg-neutral-200 min-h-screen p-4'>
            <div className='bg-white rounded-2xl w-full h-full flex flex-col items-center justify-center shadow-xl'>
                <div className='relative isolate flex items-center justify-center py-8 bg-linear-to-br shadow-lg from-[#64d857] to-[#42b635] bg-dots dot-size-24 dot-gap-12 dot-color-[#64d85740] w-full grow rounded-t-2xl'>
                    <h1 className='text-2xl font-bold uppercase text-[14vw] tracking-wide text-white font-righteous text-stroke-[0.075ch]'>khatwateen</h1>
                </div>
                <div className='flex items-center justify-between gap-4 w-full p-4 h-62 rounded-b-lg'>
                    <div>
                        <span className='text-2xl font-bold'>Welcome to our website!</span>
                    </div>
                    <div>
                        <span className='text-2xl font-bold'>Welcome to our website!</span>
                    </div>
                </div>
            </div>
        </section>
    )
}

export default Hero