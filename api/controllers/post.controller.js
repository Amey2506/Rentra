import prisma from "../lib/prisma.js";
import jwt from "jsonwebtoken";

export const getPosts = async (req, res) => {
  const query = req.query;
  const searchTerm = query.city; 
  
  // Array to hold all filter conditions
  const filterConditions = [];

  // 1. Add Location/Search Term Filter (The OR Logic)
  if (searchTerm) {
    filterConditions.push({
      OR: [
        { city: { contains: searchTerm, mode: "insensitive" } },
        { address: { contains: searchTerm, mode: "insensitive" } },
      ],
    });
  }

  // 2. Add Type Filter
  if (query.type && query.type !== 'any') {
    filterConditions.push({ type: query.type });
  }

  // 3. Add Property Filter
  if (query.property && query.property !== 'any') {
    filterConditions.push({ property: query.property });
  }
  
  // 4. Add Bedroom Filter
  const bedroomCount = parseInt(query.bedroom);
  // Only apply filter if it's a valid number greater than 0
  if (!isNaN(bedroomCount) && bedroomCount > 0) { 
    filterConditions.push({ bedroom: bedroomCount });
  }
  
  // 5. Add Price Filter (The Final Fix for 0/empty values)
  const minPrice = parseInt(query.minPrice);
  const maxPrice = parseInt(query.maxPrice);

  // CRITICAL FIX: Only construct the price filter if AT LEAST ONE value is > 0
  const priceFilter = {};

  if (!isNaN(minPrice) && minPrice > 0) { // Only use gte if minPrice is supplied AND > 0
    priceFilter.gte = minPrice;
  }
  if (!isNaN(maxPrice) && maxPrice > 0) { // Only use lte if maxPrice is supplied AND > 0
    priceFilter.lte = maxPrice;
  }

  // Only push the price filter if we actually defined a gte or lte condition
  if (Object.keys(priceFilter).length > 0) {
    filterConditions.push({ price: priceFilter });
  }
  // --- End Price Filter Fix ---


  try {
    const posts = await prisma.post.findMany({
      where: {
          // All filter conditions are combined with the explicit AND operator.
          AND: filterConditions.length > 0 ? filterConditions : undefined,
      },
    });

    console.log("Executed Query Filters:", filterConditions); 
    console.log("Posts Found:", posts.length);

    res.status(200).json(posts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to get posts" });
  }
};

export const getPost = async (req, res) => {
  const id = req.params.id;

  // Check if the ID is a valid 24-character hex string (a valid MongoDB ObjectID)
  if (!/^[0-9a-fA-F]{24}$/.test(id)) {
    return res.status(404).json({ message: "Post not found" });
  }

  let isSaved = false; // Initialize save status to false
  try {
    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        postDetail: true,
        user: {
          select: {
            id: true, 
            username: true,
            avatar: true,
          },
        },
      },
    });

    if (!post) return res.status(404).json({ message: "Post not found" });

    const token = req.cookies?.token;

    if (token) {
      // Use a promise wrapper to handle the asynchronous JWT verification
      await new Promise((resolve, reject) => {
        jwt.verify(
          token,
          process.env.JWT_SECRET_KEY,
          async (err, payload) => {
            if (err) {
              // Token is invalid, but proceed without saved status
              return resolve();
            }

            // Token is valid, check if post is saved
            const saved = await prisma.savedPost.findUnique({
              where: {
                userId_postId: { 
                  postId: id,
                  userId: payload.id,
                },
              },
            });

            isSaved = saved ? true : false;
            resolve();
          }
        );
      });
    }

    // Send the final, combined response here, after verification is complete
    res.status(200).json({ ...post, isSaved });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Failed to get post" });
  }
};

export const addPost = async (req, res) => {
  const body = req.body;
  const tokenUserId = req.userId;

  try {
    const newPost = await prisma.post.create({
      data: {
        ...body.postData,
        userId: tokenUserId,
        postDetail: {
          create: body.postDetail,
        },
      },
    });
    res.status(200).json(newPost);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Failed to create post" });
  }
};

export const updatePost = async (req, res) => {
  try {
    res.status(200).json();
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Failed to update posts" });
  }
};

export const deletePost = async (req, res) => {
  const id = req.params.id;
  const tokenUserId = req.userId;

  try {
    const post = await prisma.post.findUnique({
      where: { id },
    });

    if (post.userId !== tokenUserId) {
      return res.status(403).json({ message: "Not Authorized!" });
    }
    
    // FIX: DELETE DEPENDENT RECORDS FIRST
    // 1. Delete PostDetail (Mandatory one-to-one relation)
    await prisma.postDetail.delete({
        where: { postId: id },
    });
    
    // 2. Delete SavedPost records (Many-to-one relation)
    await prisma.savedPost.deleteMany({
        where: { postId: id }, // Delete ALL saved instances of this post
    });

    // 3. Delete the main Post
    await prisma.post.delete({
      where: { id },
    });

    res.status(200).json({ message: "Post deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete post due to database constraints!" });
  }
};