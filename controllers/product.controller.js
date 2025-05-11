import { redis } from "../lib/redis.js"
import cloudinary  from "../lib/cloudinary.js"
import Product from "../models/product.model.js"

export const getAllProducts= async (req, res)=>{
    try {
        const products= await Product.find({}) //find all products
        if (!products) {
            return res.status(404).json({ message: "No products found" });  // Return after response
          }
        res.status(200).json(products); // Send a single response to the client
    } catch (error) {
        console.log('Error in getAllProduct controller', error.message)
         res.status(500).json({message: 'Server Error'})
    }
}
export const getFeaturedProducts = async (req, res) => {
    try {
        let featuredProducts = await redis.get('featured_products')
        if (featuredProducts) {
            return res.json(JSON.parse(featuredProducts))
        }
        // if not in redis then fitch it from mongodb
        // .lean() returns a plain javascript object instead of mongodb document
        // which is good for performance
        featuredProducts = await Product.find({ featured: true }).lean()
        if (!featuredProducts) {
            return res.status(404).json({ message: 'No featured products found' })
        }
       // it is found in mongodb then store in redis for future quick access
       await redis.set('featured_products', JSON.stringify(featuredProducts))
       res.json(featuredProducts)
    } catch (error) {
        console.log('Error in getfeaturedProducts controller', error.message)
        res.status(500).json({ message: 'Server Error', error: error.message })
    }
}
export const createProduct = async (req, res) => {
    try {
        const { name, description, price, image, category } = req.body;
        let cloudinaryResponse = null;

        if (image) {
            cloudinaryResponse = await cloudinary.uploader.upload(image, { folder: 'products' });
        }

        const product = await Product.create({
            name,
            description,
            price,
            image: cloudinaryResponse?.secure_url ? cloudinaryResponse.secure_url : "",
            category
        });

        return res.status(201).json(product); // Use return to prevent further execution

    } catch (error) {
        console.error('Error in createProduct controller:', error.message);
        
        // There's no need to check if headers have been sent here
        // Instead, just ensure you're not sending multiple responses in general
         res.status(500).json({ message: 'Server Error', error: error.message });
    }
};


export const deleteProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id)
        if(!product){
            return res.status(404).json({message: 'Product not found'})
        }
        if(product.image){
            const publicId= product.image.split('/').pop().split('.')[0] // this will get the id
            try {
                await cloudinary.uploader.destroy(`product/${publicId}`)
                console.log('Successfully deleted product')
            } catch (error) {
                console.log('failed to delete product image from cloudinary', error)
            }
        }
        await Product.findByIdAndDelete(req.params.id);
        res.json({message: 'Product deleted successfully'})
    } catch (error) {
        console.log('Error in deletProduct controller', error)
        res.status(500).json({ message: 'Server Error', error: error.message })
    }
}

export const getRecommendedProducts= async (req, res) => {
    try {
        const products = await Product.aggregate([
           {
            $sample: {size:3}
           },
           {
            $project: {
                _id:1,
                name:1,
                description:1,
                price:1,
                image:1
                }
              }
        ])
        res.json(products)
    } catch (error) {
        console.log('error in getRecommendationProduct controller', error)
        res.status(500).json({ message: 'Server Error', error: error.message })
    }
}
export const getProductsBycategory= async (req, res) => {
    const {category} = req.params
    try {
        const products = await Product.find({category})
        res.json(products)
    } catch (error) {
        console.log('error in getProductsByCategory controller', error)
        res.status(500).json({ message: 'Server Error', error: error.message })
    }
}

export const toggleFeaturedProduct= async (req, res)=>{
    try {
        const product = await Product.findById(req.params.id);
        if(product){
            product.isFeatured =!product.isFeatured;
            const updatededProduct = await product.save()
             await updateFeaturedProductCache()
             res.json(updatededProduct)
        }
        else{
            res.status(404).json({message: 'Product not found'})
        }
    } catch (error) {
        console.log( 'Error in toggleFeaturedProduct controller', error )
        res.status(500).json({ message: 'Server Error', error: error.message })
    }
}

async function updateFeaturedProductCache(){
    try {
        const featuredProduct = await Product.find({isFeatured: true}).lean()
        await redis.set('featured_products', JSON.stringify(featuredProduct))
    } catch (error) {
        console.log('Error in update cache function');
    }
}