import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

// Constants and needed functions
export const svgAttributes = {
    x: 10,
    y: 10,
    width: 700,
    height: 600
};

function euclideanDistance(a, b) {
    return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

// Determine closest centroid and assign to cluster
export function nearestCentroid(node) {
    let distances = centroids.map((c) => euclideanDistance(c, node));
    return distances.findIndex(distance => distance === Math.min(...distances));
}

// Determine average distance to update centroids
export function average(values) {
    if (!values.length) {
        return 0;
    }

    let sum = 0;
    values.forEach((number) => {
        sum += number
    });

    return sum / values.length;
}

export function initializeData(clusters, dataPointAmount) {
    let centroids = d3.range(clusters).map(() => ({
        x: Math.floor(Math.random() * dataPointAmount),
        y: Math.floor(Math.random() * dataPointAmount),
    }));

    let data = d3.range(dataPointAmount).map(() => ({
        x: Math.floor(Math.random() * dataPointAmount),
        y: Math.floor(Math.random() * dataPointAmount),
        cluster: null
    }));

    return {centroids, data};
}