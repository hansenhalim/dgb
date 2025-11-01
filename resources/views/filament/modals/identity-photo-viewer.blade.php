<div class="flex justify-center items-center p-4">
    @if($photoUrl)
        <img
            src="{{ $photoUrl }}"
            alt="Identity Photo"
            class="max-w-full max-h-[70vh] object-contain rounded-lg"
        />
    @else
        <div class="text-center text-gray-500">
            <p>No photo available</p>
        </div>
    @endif
</div>
