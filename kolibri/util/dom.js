/**
 * @module util/dom
 * Copied from Kolibri. Only the `dom` helper that the test suite uses.
 */

/**
 * Create DOM objects from an HTML string.
 * @param  { String } innerString
 * @return { ArrayLike<Element> }
 */
const dom = innerString => {
    if (typeof document === "undefined") {
        return [];
    }
    const holder = document.createElement("DIV");
    holder.innerHTML = innerString;
    return holder.children;
};

export { dom };
