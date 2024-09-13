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
export function nearestCentroid(node, centroids) {
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

export function initializeCentroids(clusters, dataPointAmount) {
    let centroids = d3.range(clusters).map(() => ({
        x: Math.floor(Math.random() * dataPointAmount),
        y: Math.floor(Math.random() * dataPointAmount),
    }));

    return centroids;
}

export function initializeRandomData(dataPointAmount) {
    let data = d3.range(dataPointAmount).map(() => ({
        x: Math.floor(Math.random() * dataPointAmount),
        y: Math.floor(Math.random() * dataPointAmount),
        cluster: null
    }));
    return data;
}

function isValidCenter(newCenter, centers, minDistance) {
    return centers.every(center => {
        const distance = Math.sqrt(
            Math.pow(center.x - newCenter.x, 2) + Math.pow(center.y - newCenter.y, 2)
        );
        return distance >= minDistance;
    });
}

export function initializeCircularData(dataPointAmount, circles) {
    const RADIUS = 8;
    const MIN_DISTANCE = 2 * RADIUS;
    let angle = null;
    let radius = null;

    let validCenters = []

    while (validCenters.length < circles){
        let potentialCenter = {
            x: Math.floor(Math.random() * (dataPointAmount - 2 * RADIUS)) + RADIUS,
            y: Math.floor(Math.random() * (dataPointAmount - 2 * RADIUS)) + RADIUS,
        };

        if (isValidCenter(potentialCenter, validCenters, MIN_DISTANCE)){
            validCenters.push(potentialCenter);
        }
    }

    let data = validCenters.flatMap(center => 
        d3.range(Math.floor(dataPointAmount / circles)).map(() => {
            angle = Math.random() * 2 * Math.PI;
            radius = RADIUS * Math.sqrt(Math.random());
            return {
                x: center.x + radius * Math.cos(angle),
                y: center.y + radius * Math.sin(angle),
                cluster: null
            };
        })
    );

    return data;
}
export function initializeGaussianData(dataPointAmount, clusters) {
    let data = [];
    const clusterCenters = initializeCentroids(clusters, dataPointAmount);
    const variance = dataPointAmount * 0.02;
    const gaussian = d3.randomNormal(0, Math.sqrt(variance));

    clusterCenters.forEach(center => {
        let clusterData = d3.range(dataPointAmount / clusters).map(() => ({
            x: center.x + gaussian(),
            y: center.y + gaussian(),
            cluster: null
        }));
        data = data.concat(clusterData);
    });

    return data;
}


export function initializeGridData(dataPointAmount, clusters) {
    const gridSize = Math.ceil(Math.sqrt(dataPointAmount));
    let data = [];

    for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
            if (data.length >= dataPointAmount) break;
            data.push({
                x: i * (svgAttributes.width / gridSize),
                y: j * (svgAttributes.height / gridSize),
                cluster: null
            });
        }
    }

    return data;
}
