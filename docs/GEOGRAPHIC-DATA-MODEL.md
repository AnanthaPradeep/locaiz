# Geographic data model

Stable location IDs point to an optional parent. Optional administrative levels let Vietnam, India and China use their own hierarchy. A country supplies its ISO code to descendants. Map coordinates identify localities, with no claim about a supplier's precise address.

The directory searches across the product's origin and the supplier's base. The product passport and offer cards label each place separately. A single example can be woven in Pattamadai, traded from Surat, held for pickup in Surat, and eligible for delivery in India.

The SQL schema stores base, manufacturing, product origin, stock, pickup and shipping-origin locations separately. Geographic and category records are operator-managed. Importers must validate parent chains before publishing. Future radius search can use a PostGIS geography point and a GiST index once a connected directory is configured.

The regional background uses the [Pattamadai mats registry](https://search.ipindia.gov.in/GIRPublicSearch/Application/Details/195), [Tiruppur textile information](https://tntextilesschemes.tn.gov.in/dir-industries-list), [Yiwu industrial belt](https://www.ezhejiang.gov.cn/eyiwu/2023-01/31/c_851011.htm), and [Shenzhen industry clusters](https://www.sz.gov.cn/en_szgov/business/key/content/post_11575453.html). These references describe regional context. Sample products carry no certification.
